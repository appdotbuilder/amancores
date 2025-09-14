import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type UpdatePostInput, type CreateUserInput, type CreatePostInput } from '../schema';
import { updatePost, deletePost } from '../handlers/update_post';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'A test user',
  avatar_url: null,
};

const testPost: CreatePostInput = {
  user_id: 1, // Will be set after user creation
  content: 'This is a test post content',
  media_urls: ['https://example.com/image1.jpg'],
  parent_post_id: null,
};

describe('updatePost', () => {
  let userId: number;
  let postId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();
    
    userId = userResult[0].id;

    // Create test post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: testPost.content,
        media_urls: testPost.media_urls,
        parent_post_id: testPost.parent_post_id,
      })
      .returning()
      .execute();

    postId = postResult[0].id;
  });

  afterEach(resetDB);

  it('should update post content', async () => {
    const updateInput: UpdatePostInput = {
      id: postId,
      content: 'Updated post content',
    };

    const result = await updatePost(updateInput);

    expect(result.id).toEqual(postId);
    expect(result.content).toEqual('Updated post content');
    expect(result.user_id).toEqual(userId);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > result.created_at).toBe(true);
  });

  it('should update pin status', async () => {
    const updateInput: UpdatePostInput = {
      id: postId,
      is_pinned: true,
    };

    const result = await updatePost(updateInput);

    expect(result.id).toEqual(postId);
    expect(result.is_pinned).toBe(true);
    expect(result.content).toEqual(testPost.content); // Original content unchanged
  });

  it('should update both content and pin status', async () => {
    const updateInput: UpdatePostInput = {
      id: postId,
      content: 'New content for pinned post',
      is_pinned: true,
    };

    const result = await updatePost(updateInput);

    expect(result.id).toEqual(postId);
    expect(result.content).toEqual('New content for pinned post');
    expect(result.is_pinned).toBe(true);
  });

  it('should save updated post to database', async () => {
    const updateInput: UpdatePostInput = {
      id: postId,
      content: 'Database update test',
      is_pinned: true,
    };

    await updatePost(updateInput);

    // Query database directly to verify update
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].content).toEqual('Database update test');
    expect(posts[0].is_pinned).toBe(true);
    expect(posts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should preserve other post fields when updating', async () => {
    const updateInput: UpdatePostInput = {
      id: postId,
      content: 'Only content changed',
    };

    const result = await updatePost(updateInput);

    // All other fields should remain unchanged
    expect(result.media_urls).toEqual(testPost.media_urls);
    expect(result.like_count).toEqual(0);
    expect(result.repost_count).toEqual(0);
    expect(result.reply_count).toEqual(0);
    expect(result.parent_post_id).toBeNull();
  });

  it('should throw error for non-existent post', async () => {
    const updateInput: UpdatePostInput = {
      id: 999999,
      content: 'This should fail',
    };

    await expect(updatePost(updateInput)).rejects.toThrow(/Post not found/i);
  });

  it('should handle partial updates correctly', async () => {
    // Update only is_pinned
    const pinUpdate: UpdatePostInput = {
      id: postId,
      is_pinned: true,
    };

    const result1 = await updatePost(pinUpdate);
    expect(result1.is_pinned).toBe(true);
    expect(result1.content).toEqual(testPost.content);

    // Update only content
    const contentUpdate: UpdatePostInput = {
      id: postId,
      content: 'New content only',
    };

    const result2 = await updatePost(contentUpdate);
    expect(result2.content).toEqual('New content only');
    expect(result2.is_pinned).toBe(true); // Should preserve previous update
  });
});

describe('deletePost', () => {
  let userId: number;
  let postId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
        post_count: 1, // Set initial post count
      })
      .returning()
      .execute();
    
    userId = userResult[0].id;

    // Create test post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: testPost.content,
        media_urls: testPost.media_urls,
        parent_post_id: testPost.parent_post_id,
      })
      .returning()
      .execute();

    postId = postResult[0].id;
  });

  afterEach(resetDB);

  it('should delete post successfully', async () => {
    const result = await deletePost(postId);

    expect(result).toBe(true);

    // Verify post is deleted from database
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

    expect(posts).toHaveLength(0);
  });

  it('should update user post count after deletion', async () => {
    await deletePost(postId);

    // Check that user's post count was updated
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].post_count).toEqual(0);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle multiple posts deletion correctly', async () => {
    // Create another post for the same user
    const secondPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Second test post',
        media_urls: null,
        parent_post_id: null,
      })
      .returning()
      .execute();

    const secondPostId = secondPostResult[0].id;

    // Update user's post count to 2
    await db.update(usersTable)
      .set({ post_count: 2 })
      .where(eq(usersTable.id, userId))
      .execute();

    // Delete first post
    await deletePost(postId);

    // Verify user's post count is now 1
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users[0].post_count).toEqual(1);

    // Verify second post still exists
    const remainingPosts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.user_id, userId))
      .execute();

    expect(remainingPosts).toHaveLength(1);
    expect(remainingPosts[0].id).toEqual(secondPostId);
  });

  it('should throw error for non-existent post', async () => {
    await expect(deletePost(999999)).rejects.toThrow(/Post not found/i);
  });

  it('should not affect other users when deleting post', async () => {
    // Create another user with a post
    const otherUserResult = await db.insert(usersTable)
      .values({
        username: 'otheruser',
        email: 'other@example.com',
        display_name: 'Other User',
        bio: null,
        avatar_url: null,
        post_count: 1,
      })
      .returning()
      .execute();

    const otherUserId = otherUserResult[0].id;

    const otherPostResult = await db.insert(postsTable)
      .values({
        user_id: otherUserId,
        content: 'Other user post',
        media_urls: null,
        parent_post_id: null,
      })
      .returning()
      .execute();

    // Delete original post
    await deletePost(postId);

    // Verify other user and post are unaffected
    const otherUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, otherUserId))
      .execute();

    const otherPosts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.user_id, otherUserId))
      .execute();

    expect(otherUser[0].post_count).toEqual(1);
    expect(otherPosts).toHaveLength(1);
    expect(otherPosts[0].content).toEqual('Other user post');
  });
});