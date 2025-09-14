import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type UpdatePostInput, type Post } from '../schema';
import { eq, count } from 'drizzle-orm';

export const updatePost = async (input: UpdatePostInput): Promise<Post> => {
  try {
    // Check if post exists first
    const existingPost = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, input.id))
      .execute();

    if (existingPost.length === 0) {
      throw new Error('Post not found');
    }

    // Build update values object - only include fields that are provided
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.content !== undefined) {
      updateValues.content = input.content;
    }

    if (input.is_pinned !== undefined) {
      updateValues.is_pinned = input.is_pinned;
    }

    // Update post record
    const result = await db.update(postsTable)
      .set(updateValues)
      .where(eq(postsTable.id, input.id))
      .returning()
      .execute();

    // Return the updated post
    const updatedPost = result[0];
    return {
      ...updatedPost,
      media_urls: updatedPost.media_urls as string[] | null
    };
  } catch (error) {
    console.error('Post update failed:', error);
    throw error;
  }
};

export const deletePost = async (id: number): Promise<boolean> => {
  try {
    // Check if post exists first
    const existingPost = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .execute();

    if (existingPost.length === 0) {
      throw new Error('Post not found');
    }

    const post = existingPost[0];

    // Delete the post record
    await db.delete(postsTable)
      .where(eq(postsTable.id, id))
      .execute();

    // Update user's post count
    const postCountResult = await db.select({ count: count(postsTable.id) })
      .from(postsTable)
      .where(eq(postsTable.user_id, post.user_id))
      .execute();

    await db.update(usersTable)
      .set({
        post_count: postCountResult[0].count,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, post.user_id))
      .execute();

    return true;
  } catch (error) {
    console.error('Post deletion failed:', error);
    throw error;
  }
};