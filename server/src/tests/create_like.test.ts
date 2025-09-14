import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { likesTable, postsTable, usersTable } from '../db/schema';
import { type CreateLikeInput } from '../schema';
import { createLike, deleteLike } from '../handlers/create_like';
import { eq, and } from 'drizzle-orm';

describe('createLike', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a like successfully', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User'
      })
      .returning()
      .execute();

    // Create a post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    const testInput: CreateLikeInput = {
      user_id: userResult[0].id,
      post_id: postResult[0].id
    };

    const result = await createLike(testInput);

    // Verify like was created
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(testInput.user_id);
    expect(result.post_id).toEqual(testInput.post_id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save like to database', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    const testInput: CreateLikeInput = {
      user_id: userResult[0].id,
      post_id: postResult[0].id
    };

    const result = await createLike(testInput);

    // Verify like exists in database
    const likes = await db.select()
      .from(likesTable)
      .where(eq(likesTable.id, result.id))
      .execute();

    expect(likes).toHaveLength(1);
    expect(likes[0].user_id).toEqual(testInput.user_id);
    expect(likes[0].post_id).toEqual(testInput.post_id);
    expect(likes[0].created_at).toBeInstanceOf(Date);
  });

  it('should increment post like count', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    const initialLikeCount = postResult[0].like_count;

    const testInput: CreateLikeInput = {
      user_id: userResult[0].id,
      post_id: postResult[0].id
    };

    await createLike(testInput);

    // Verify post like count was incremented
    const updatedPost = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postResult[0].id))
      .execute();

    expect(updatedPost[0].like_count).toEqual(initialLikeCount + 1);
  });

  it('should throw error when user does not exist', async () => {
    // Create a post with a different user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    const testInput: CreateLikeInput = {
      user_id: 999, // Non-existent user
      post_id: postResult[0].id
    };

    await expect(createLike(testInput)).rejects.toThrow(/user not found/i);
  });

  it('should throw error when post does not exist', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const testInput: CreateLikeInput = {
      user_id: userResult[0].id,
      post_id: 999 // Non-existent post
    };

    await expect(createLike(testInput)).rejects.toThrow(/post not found/i);
  });

  it('should prevent duplicate likes', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    const testInput: CreateLikeInput = {
      user_id: userResult[0].id,
      post_id: postResult[0].id
    };

    // Create first like
    await createLike(testInput);

    // Attempt to create duplicate like
    await expect(createLike(testInput)).rejects.toThrow(/like already exists/i);
  });
});

describe('deleteLike', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete like successfully', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    // Create a like first
    await db.insert(likesTable)
      .values({
        user_id: userResult[0].id,
        post_id: postResult[0].id
      })
      .execute();

    const result = await deleteLike(userResult[0].id, postResult[0].id);

    expect(result).toBe(true);
  });

  it('should remove like from database', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    // Create a like first
    await db.insert(likesTable)
      .values({
        user_id: userResult[0].id,
        post_id: postResult[0].id
      })
      .execute();

    await deleteLike(userResult[0].id, postResult[0].id);

    // Verify like was removed from database
    const likes = await db.select()
      .from(likesTable)
      .where(and(
        eq(likesTable.user_id, userResult[0].id),
        eq(likesTable.post_id, postResult[0].id)
      ))
      .execute();

    expect(likes).toHaveLength(0);
  });

  it('should decrement post like count', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content',
        like_count: 5 // Set initial like count
      })
      .returning()
      .execute();

    // Create a like first
    await db.insert(likesTable)
      .values({
        user_id: userResult[0].id,
        post_id: postResult[0].id
      })
      .execute();

    await deleteLike(userResult[0].id, postResult[0].id);

    // Verify post like count was decremented
    const updatedPost = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postResult[0].id))
      .execute();

    expect(updatedPost[0].like_count).toEqual(4);
  });

  it('should throw error when like does not exist', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userResult[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    // Try to delete non-existent like
    await expect(deleteLike(userResult[0].id, postResult[0].id))
      .rejects.toThrow(/like not found/i);
  });

  it('should handle multiple users liking same post', async () => {
    // Create multiple users
    const user1Result = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com'
      })
      .returning()
      .execute();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    // Both users like the post
    await createLike({ user_id: user1Result[0].id, post_id: postResult[0].id });
    await createLike({ user_id: user2Result[0].id, post_id: postResult[0].id });

    // Delete one like
    await deleteLike(user1Result[0].id, postResult[0].id);

    // Verify only one like was deleted
    const remainingLikes = await db.select()
      .from(likesTable)
      .where(eq(likesTable.post_id, postResult[0].id))
      .execute();

    expect(remainingLikes).toHaveLength(1);
    expect(remainingLikes[0].user_id).toEqual(user2Result[0].id);

    // Verify like count is correct
    const updatedPost = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postResult[0].id))
      .execute();

    expect(updatedPost[0].like_count).toEqual(1);
  });
});