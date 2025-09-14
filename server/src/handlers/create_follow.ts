import { db } from '../db';
import { followsTable, usersTable } from '../db/schema';
import { type CreateFollowInput, type Follow } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export const createFollow = async (input: CreateFollowInput): Promise<Follow> => {
  try {
    // Prevent self-follow
    if (input.follower_id === input.following_id) {
      throw new Error('Users cannot follow themselves');
    }

    // Verify both users exist
    const users = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, input.follower_id),
          eq(usersTable.id, input.following_id)
        )
      )
      .execute();

    if (users.length < 2) {
      // Check which users exist to provide specific error
      const followerExists = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, input.follower_id))
        .execute();

      const followingExists = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, input.following_id))
        .execute();

      if (followerExists.length === 0) {
        throw new Error(`User with id ${input.follower_id} does not exist`);
      }
      if (followingExists.length === 0) {
        throw new Error(`User with id ${input.following_id} does not exist`);
      }
    }

    // Check if follow relationship already exists
    const existingFollow = await db.select()
      .from(followsTable)
      .where(
        and(
          eq(followsTable.follower_id, input.follower_id),
          eq(followsTable.following_id, input.following_id)
        )
      )
      .execute();

    if (existingFollow.length > 0) {
      throw new Error('Follow relationship already exists');
    }

    // Insert follow record
    const result = await db.insert(followsTable)
      .values({
        follower_id: input.follower_id,
        following_id: input.following_id
      })
      .returning()
      .execute();

    // Update follower counts
    await db.execute(sql`
      UPDATE ${usersTable} 
      SET following_count = following_count + 1 
      WHERE id = ${input.follower_id}
    `);

    await db.execute(sql`
      UPDATE ${usersTable} 
      SET follower_count = follower_count + 1 
      WHERE id = ${input.following_id}
    `);

    return result[0];
  } catch (error) {
    console.error('Follow creation failed:', error);
    throw error;
  }
};

export const deleteFollow = async (followerId: number, followingId: number): Promise<boolean> => {
  try {
    // Check if follow relationship exists
    const existingFollow = await db.select()
      .from(followsTable)
      .where(
        and(
          eq(followsTable.follower_id, followerId),
          eq(followsTable.following_id, followingId)
        )
      )
      .execute();

    if (existingFollow.length === 0) {
      throw new Error('Follow relationship does not exist');
    }

    // Delete follow record
    await db.delete(followsTable)
      .where(
        and(
          eq(followsTable.follower_id, followerId),
          eq(followsTable.following_id, followingId)
        )
      )
      .execute();

    // Update follower counts
    await db.execute(sql`
      UPDATE ${usersTable} 
      SET following_count = following_count - 1 
      WHERE id = ${followerId}
    `);

    await db.execute(sql`
      UPDATE ${usersTable} 
      SET follower_count = follower_count - 1 
      WHERE id = ${followingId}
    `);

    return true;
  } catch (error) {
    console.error('Follow deletion failed:', error);
    throw error;
  }
};