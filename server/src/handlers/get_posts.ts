import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type Post } from '../schema';
import { eq, desc, isNull } from 'drizzle-orm';

export const getPosts = async (): Promise<Post[]> => {
  try {
    const results = await db.select()
      .from(postsTable)
      .where(isNull(postsTable.parent_post_id)) // Only top-level posts (not replies)
      .orderBy(desc(postsTable.created_at))
      .limit(50) // Default pagination limit
      .execute();

    return results.map(post => ({
      ...post,
      media_urls: post.media_urls as string[] | null,
    }));
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    throw error;
  }
};

export const getPostById = async (id: number): Promise<Post | null> => {
  try {
    const results = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    const post = results[0];
    return {
      ...post,
      media_urls: post.media_urls as string[] | null,
    };
  } catch (error) {
    console.error('Failed to fetch post by ID:', error);
    throw error;
  }
};

export const getPostsByUserId = async (userId: number): Promise<Post[]> => {
  try {
    // Verify user exists first to prevent returning empty array for invalid user_id
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with id ${userId} does not exist`);
    }

    const results = await db.select()
      .from(postsTable)
      .where(eq(postsTable.user_id, userId))
      .orderBy(desc(postsTable.created_at))
      .execute();

    return results.map(post => ({
      ...post,
      media_urls: post.media_urls as string[] | null,
    }));
  } catch (error) {
    console.error('Failed to fetch posts by user ID:', error);
    throw error;
  }
};

export const getPostReplies = async (postId: number): Promise<Post[]> => {
  try {
    // Verify parent post exists first
    const parentExists = await db.select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1)
      .execute();

    if (parentExists.length === 0) {
      throw new Error(`Post with id ${postId} does not exist`);
    }

    const results = await db.select()
      .from(postsTable)
      .where(eq(postsTable.parent_post_id, postId))
      .orderBy(desc(postsTable.created_at)) // Most recent replies first
      .execute();

    return results.map(post => ({
      ...post,
      media_urls: post.media_urls as string[] | null,
    }));
  } catch (error) {
    console.error('Failed to fetch post replies:', error);
    throw error;
  }
};