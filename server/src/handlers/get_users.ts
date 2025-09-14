import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq, ilike } from 'drizzle-orm';

export const getUsers = async (): Promise<User[]> => {
  try {
    const results = await db.select()
      .from(usersTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};

export const getUserById = async (id: number): Promise<User | null> => {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    throw error;
  }
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(ilike(usersTable.username, username))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to fetch user by username:', error);
    throw error;
  }
};