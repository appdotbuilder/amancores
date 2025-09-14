import { db } from '../db';
import { followsTable, usersTable } from '../db/schema';
import { type Follow, type User } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getFollowers = async (userId: number): Promise<User[]> => {
  try {
    // Get all users who follow the specified user
    // Join follows table with users table to get follower profile data
    const results = await db.select()
      .from(followsTable)
      .innerJoin(usersTable, eq(followsTable.follower_id, usersTable.id))
      .where(eq(followsTable.following_id, userId))
      .execute();

    // Extract user data from joined results
    return results.map(result => result.users);
  } catch (error) {
    console.error('Failed to get followers:', error);
    throw error;
  }
};

export const getFollowing = async (userId: number): Promise<User[]> => {
  try {
    // Get all users that the specified user follows
    // Join follows table with users table to get following user profile data
    const results = await db.select()
      .from(followsTable)
      .innerJoin(usersTable, eq(followsTable.following_id, usersTable.id))
      .where(eq(followsTable.follower_id, userId))
      .execute();

    // Extract user data from joined results
    return results.map(result => result.users);
  } catch (error) {
    console.error('Failed to get following:', error);
    throw error;
  }
};

export const getFollowRelationship = async (followerId: number, followingId: number): Promise<Follow | null> => {
  try {
    // Check if a follow relationship exists between two users
    const results = await db.select()
      .from(followsTable)
      .where(and(
        eq(followsTable.follower_id, followerId),
        eq(followsTable.following_id, followingId)
      ))
      .execute();

    // Return the follow relationship if it exists, null otherwise
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to get follow relationship:', error);
    throw error;
  }
};