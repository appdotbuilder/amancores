import { db } from '../db';
import { likesTable, postsTable, usersTable } from '../db/schema';
import { type CreateLikeInput, type Like } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export const createLike = async (input: CreateLikeInput): Promise<Like> => {
  try {
    // First, verify the user exists
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error('User not found');
    }

    // Verify the post exists
    const postExists = await db.select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, input.post_id))
      .execute();

    if (postExists.length === 0) {
      throw new Error('Post not found');
    }

    // Check if like already exists to prevent duplicates
    const existingLike = await db.select({ id: likesTable.id })
      .from(likesTable)
      .where(and(
        eq(likesTable.user_id, input.user_id),
        eq(likesTable.post_id, input.post_id)
      ))
      .execute();

    if (existingLike.length > 0) {
      throw new Error('Like already exists');
    }

    // Create the like in a transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Insert the like
      const likeResult = await tx.insert(likesTable)
        .values({
          user_id: input.user_id,
          post_id: input.post_id
        })
        .returning()
        .execute();

      // Update the post's like count
      await tx.update(postsTable)
        .set({
          like_count: sql`${postsTable.like_count} + 1`
        })
        .where(eq(postsTable.id, input.post_id))
        .execute();

      return likeResult[0];
    });

    return result;
  } catch (error) {
    console.error('Like creation failed:', error);
    throw error;
  }
};

export const deleteLike = async (userId: number, postId: number): Promise<boolean> => {
  try {
    // Check if the like exists
    const existingLike = await db.select({ id: likesTable.id })
      .from(likesTable)
      .where(and(
        eq(likesTable.user_id, userId),
        eq(likesTable.post_id, postId)
      ))
      .execute();

    if (existingLike.length === 0) {
      throw new Error('Like not found');
    }

    // Delete the like in a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete the like
      await tx.delete(likesTable)
        .where(and(
          eq(likesTable.user_id, userId),
          eq(likesTable.post_id, postId)
        ))
        .execute();

      // Update the post's like count
      await tx.update(postsTable)
        .set({
          like_count: sql`${postsTable.like_count} - 1`
        })
        .where(eq(postsTable.id, postId))
        .execute();
    });

    return true;
  } catch (error) {
    console.error('Like deletion failed:', error);
    throw error;
  }
};