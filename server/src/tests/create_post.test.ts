import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type CreatePostInput } from '../schema';
import { createPost } from '../handlers/create_post';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'A test user',
  avatar_url: 'https://example.com/avatar.jpg'
};

// Simple test input
const testInput: CreatePostInput = {
  user_id: 1, // Will be set after user creation
  content: 'This is a test post content',
  media_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
  parent_post_id: null
};

describe('createPost', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a post successfully', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];
    const input = { ...testInput, user_id: user.id };

    const result = await createPost(input);

    // Basic field validation
    expect(result.user_id).toEqual(user.id);
    expect(result.content).toEqual('This is a test post content');
    expect(result.media_urls).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']);
    expect(result.like_count).toEqual(0);
    expect(result.repost_count).toEqual(0);
    expect(result.reply_count).toEqual(0);
    expect(result.is_pinned).toEqual(false);
    expect(result.parent_post_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save post to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];
    const input = { ...testInput, user_id: user.id };

    const result = await createPost(input);

    // Verify post was saved to database
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, result.id))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].user_id).toEqual(user.id);
    expect(posts[0].content).toEqual('This is a test post content');
    expect(posts[0].media_urls).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']);
    expect(posts[0].created_at).toBeInstanceOf(Date);
  });

  it('should update user post count', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];
    const input = { ...testInput, user_id: user.id };

    // Initial post count should be 0
    expect(user.post_count).toEqual(0);

    await createPost(input);

    // Check updated user post count
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers[0].post_count).toEqual(1);
    expect(updatedUsers[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create a reply post and update parent reply count', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];

    // Create parent post
    const parentPostInput = { ...testInput, user_id: user.id };
    const parentPost = await createPost(parentPostInput);

    // Create reply post
    const replyInput: CreatePostInput = {
      user_id: user.id,
      content: 'This is a reply to the parent post',
      media_urls: null,
      parent_post_id: parentPost.id
    };

    const replyPost = await createPost(replyInput);

    // Verify reply post properties
    expect(replyPost.parent_post_id).toEqual(parentPost.id);
    expect(replyPost.content).toEqual('This is a reply to the parent post');

    // Verify parent post reply count was incremented
    const updatedParentPosts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, parentPost.id))
      .execute();

    expect(updatedParentPosts[0].reply_count).toEqual(1);
  });

  it('should handle posts with null media_urls', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];
    
    const inputWithNullMedia: CreatePostInput = {
      user_id: user.id,
      content: 'Post without media',
      media_urls: null,
      parent_post_id: null
    };

    const result = await createPost(inputWithNullMedia);

    expect(result.media_urls).toBeNull();
    expect(result.content).toEqual('Post without media');
  });

  it('should throw error when user does not exist', async () => {
    const input: CreatePostInput = {
      user_id: 999, // Non-existent user ID
      content: 'This should fail',
      media_urls: null,
      parent_post_id: null
    };

    await expect(createPost(input)).rejects.toThrow(/User not found/i);
  });

  it('should throw error when parent post does not exist', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];

    const input: CreatePostInput = {
      user_id: user.id,
      content: 'Reply to non-existent post',
      media_urls: null,
      parent_post_id: 999 // Non-existent parent post ID
    };

    await expect(createPost(input)).rejects.toThrow(/Parent post not found/i);
  });

  it('should handle multiple replies to same parent post', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const user = userResult[0];

    // Create parent post
    const parentPostInput = { ...testInput, user_id: user.id };
    const parentPost = await createPost(parentPostInput);

    // Create multiple replies
    const reply1Input: CreatePostInput = {
      user_id: user.id,
      content: 'First reply',
      media_urls: null,
      parent_post_id: parentPost.id
    };

    const reply2Input: CreatePostInput = {
      user_id: user.id,
      content: 'Second reply',
      media_urls: null,
      parent_post_id: parentPost.id
    };

    await createPost(reply1Input);
    await createPost(reply2Input);

    // Verify parent post reply count
    const updatedParentPosts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, parentPost.id))
      .execute();

    expect(updatedParentPosts[0].reply_count).toEqual(2);

    // Verify user post count reflects all posts created
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers[0].post_count).toEqual(3); // 1 parent + 2 replies
  });
});