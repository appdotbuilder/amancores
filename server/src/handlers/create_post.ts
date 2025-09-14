import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type CreatePostInput, type Post } from '../schema';
import { eq } from 'drizzle-orm';

export const createPost = async (input: CreatePostInput): Promise<Post> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // If replying to a post, verify parent post exists
    if (input.parent_post_id) {
      const parentPost = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, input.parent_post_id))
        .execute();

      if (parentPost.length === 0) {
        throw new Error('Parent post not found');
      }
    }

    // Create the post
    const result = await db.insert(postsTable)
      .values({
        user_id: input.user_id,
        content: input.content,
        media_urls: input.media_urls,
        parent_post_id: input.parent_post_id
      })
      .returning()
      .execute();

    const post = result[0];

    // Update user post count
    await db.update(usersTable)
      .set({
        post_count: user[0].post_count + 1,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, input.user_id))
      .execute();

    // If this is a reply, increment the parent post's reply count
    if (input.parent_post_id) {
      const parentPosts = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, input.parent_post_id))
        .execute();

      await db.update(postsTable)
        .set({
          reply_count: parentPosts[0].reply_count + 1,
          updated_at: new Date()
        })
        .where(eq(postsTable.id, input.parent_post_id))
        .execute();
    }

    return post;
  } catch (error) {
    console.error('Post creation failed:', error);
    throw error;
  }
};