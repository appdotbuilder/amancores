import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { getPosts, getPostById, getPostsByUserId, getPostReplies } from '../handlers/get_posts';

describe('getPosts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no posts exist', async () => {
    const result = await getPosts();
    expect(result).toEqual([]);
  });

  it('should fetch posts ordered by created_at desc', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create posts with different timestamps
    await db.insert(postsTable)
      .values([
        {
          user_id: userId,
          content: 'First post',
          created_at: new Date('2023-01-01'),
        },
        {
          user_id: userId,
          content: 'Second post',
          created_at: new Date('2023-01-02'),
        },
        {
          user_id: userId,
          content: 'Third post',
          created_at: new Date('2023-01-03'),
        }
      ])
      .execute();

    const result = await getPosts();

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Third post'); // Most recent first
    expect(result[1].content).toBe('Second post');
    expect(result[2].content).toBe('First post');
  });

  it('should only return top-level posts (exclude replies)', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create parent post
    const parentPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Parent post',
      })
      .returning()
      .execute();
    const parentPostId = parentPostResult[0].id;

    // Create reply
    await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Reply post',
        parent_post_id: parentPostId,
      })
      .execute();

    const result = await getPosts();

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Parent post');
    expect(result[0].parent_post_id).toBeNull();
  });

  it('should handle posts with media_urls correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Post with media',
        media_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      })
      .execute();

    const result = await getPosts();

    expect(result).toHaveLength(1);
    expect(result[0].media_urls).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']);
  });
});

describe('getPostById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when post does not exist', async () => {
    const result = await getPostById(999);
    expect(result).toBeNull();
  });

  it('should fetch specific post by ID', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Test post content',
        media_urls: ['https://example.com/image.jpg'],
      })
      .returning()
      .execute();
    const postId = postResult[0].id;

    const result = await getPostById(postId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(postId);
    expect(result!.content).toBe('Test post content');
    expect(result!.user_id).toBe(userId);
    expect(result!.media_urls).toEqual(['https://example.com/image.jpg']);
    expect(result!.like_count).toBe(0);
    expect(result!.repost_count).toBe(0);
    expect(result!.reply_count).toBe(0);
    expect(result!.is_pinned).toBe(false);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should fetch reply posts correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create parent post
    const parentPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Parent post',
      })
      .returning()
      .execute();
    const parentPostId = parentPostResult[0].id;

    // Create reply
    const replyResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Reply content',
        parent_post_id: parentPostId,
      })
      .returning()
      .execute();
    const replyId = replyResult[0].id;

    const result = await getPostById(replyId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(replyId);
    expect(result!.content).toBe('Reply content');
    expect(result!.parent_post_id).toBe(parentPostId);
  });
});

describe('getPostsByUserId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should throw error when user does not exist', async () => {
    await expect(getPostsByUserId(999)).rejects.toThrow(/User with id 999 does not exist/i);
  });

  it('should return empty array when user exists but has no posts', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const result = await getPostsByUserId(userId);

    expect(result).toEqual([]);
  });

  it('should fetch all posts by specific user ordered by created_at desc', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
      })
      .returning()
      .execute();
    const user1Id = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
      })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    // Create posts for both users
    await db.insert(postsTable)
      .values([
        {
          user_id: user1Id,
          content: 'User1 post 1',
          created_at: new Date('2023-01-01'),
        },
        {
          user_id: user2Id,
          content: 'User2 post',
          created_at: new Date('2023-01-02'),
        },
        {
          user_id: user1Id,
          content: 'User1 post 2',
          created_at: new Date('2023-01-03'),
        }
      ])
      .execute();

    const result = await getPostsByUserId(user1Id);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('User1 post 2'); // Most recent first
    expect(result[1].content).toBe('User1 post 1');
    expect(result.every(post => post.user_id === user1Id)).toBe(true);
  });

  it('should include both regular posts and replies', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create parent post
    const parentPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Parent post',
      })
      .returning()
      .execute();
    const parentPostId = parentPostResult[0].id;

    // Create reply by same user
    await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'User reply',
        parent_post_id: parentPostId,
      })
      .execute();

    const result = await getPostsByUserId(userId);

    expect(result).toHaveLength(2);
    const parentPost = result.find(p => p.parent_post_id === null);
    const replyPost = result.find(p => p.parent_post_id === parentPostId);
    
    expect(parentPost).toBeDefined();
    expect(parentPost!.content).toBe('Parent post');
    expect(replyPost).toBeDefined();
    expect(replyPost!.content).toBe('User reply');
  });
});

describe('getPostReplies', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should throw error when parent post does not exist', async () => {
    await expect(getPostReplies(999)).rejects.toThrow(/Post with id 999 does not exist/i);
  });

  it('should return empty array when post exists but has no replies', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create post with no replies
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Post without replies',
      })
      .returning()
      .execute();
    const postId = postResult[0].id;

    const result = await getPostReplies(postId);

    expect(result).toEqual([]);
  });

  it('should fetch all replies to specific post ordered by created_at desc', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create parent post
    const parentPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Parent post',
      })
      .returning()
      .execute();
    const parentPostId = parentPostResult[0].id;

    // Create replies
    await db.insert(postsTable)
      .values([
        {
          user_id: userId,
          content: 'First reply',
          parent_post_id: parentPostId,
          created_at: new Date('2023-01-01'),
        },
        {
          user_id: userId,
          content: 'Second reply',
          parent_post_id: parentPostId,
          created_at: new Date('2023-01-02'),
        },
        {
          user_id: userId,
          content: 'Third reply',
          parent_post_id: parentPostId,
          created_at: new Date('2023-01-03'),
        }
      ])
      .execute();

    const result = await getPostReplies(parentPostId);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Third reply'); // Most recent first
    expect(result[1].content).toBe('Second reply');
    expect(result[2].content).toBe('First reply');
    expect(result.every(post => post.parent_post_id === parentPostId)).toBe(true);
  });

  it('should not include replies to replies (only direct children)', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create parent post
    const parentPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Parent post',
      })
      .returning()
      .execute();
    const parentPostId = parentPostResult[0].id;

    // Create direct reply
    const replyResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Direct reply',
        parent_post_id: parentPostId,
      })
      .returning()
      .execute();
    const replyId = replyResult[0].id;

    // Create reply to reply (nested reply)
    await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Nested reply',
        parent_post_id: replyId,
      })
      .execute();

    const result = await getPostReplies(parentPostId);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Direct reply');
    expect(result[0].parent_post_id).toBe(parentPostId);
  });

  it('should handle replies with media_urls correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create parent post
    const parentPostResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Parent post',
      })
      .returning()
      .execute();
    const parentPostId = parentPostResult[0].id;

    // Create reply with media
    await db.insert(postsTable)
      .values({
        user_id: userId,
        content: 'Reply with media',
        parent_post_id: parentPostId,
        media_urls: ['https://example.com/reply-image.jpg'],
      })
      .execute();

    const result = await getPostReplies(parentPostId);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Reply with media');
    expect(result[0].media_urls).toEqual(['https://example.com/reply-image.jpg']);
  });
});