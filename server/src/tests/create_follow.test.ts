import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, followsTable } from '../db/schema';
import { type CreateFollowInput } from '../schema';
import { createFollow, deleteFollow } from '../handlers/create_follow';
import { eq, and } from 'drizzle-orm';

describe('createFollow', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser1: any;
  let testUser2: any;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'follower_user',
          email: 'follower@test.com',
          display_name: 'Follower User',
          bio: 'I follow people',
          avatar_url: 'https://example.com/avatar1.jpg',
          is_verified: false,
          follower_count: 0,
          following_count: 0,
          post_count: 0
        },
        {
          username: 'following_user',
          email: 'following@test.com',
          display_name: 'Following User',
          bio: 'People follow me',
          avatar_url: 'https://example.com/avatar2.jpg',
          is_verified: true,
          follower_count: 0,
          following_count: 0,
          post_count: 0
        }
      ])
      .returning()
      .execute();

    testUser1 = users[0];
    testUser2 = users[1];
  });

  const testInput: CreateFollowInput = {
    follower_id: 1, // Will be updated in tests
    following_id: 2  // Will be updated in tests
  };

  it('should create a follow relationship', async () => {
    const input = {
      follower_id: testUser1.id,
      following_id: testUser2.id
    };

    const result = await createFollow(input);

    // Verify follow record fields
    expect(result.follower_id).toEqual(testUser1.id);
    expect(result.following_id).toEqual(testUser2.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save follow relationship to database', async () => {
    const input = {
      follower_id: testUser1.id,
      following_id: testUser2.id
    };

    const result = await createFollow(input);

    // Verify follow record exists in database
    const follows = await db.select()
      .from(followsTable)
      .where(eq(followsTable.id, result.id))
      .execute();

    expect(follows).toHaveLength(1);
    expect(follows[0].follower_id).toEqual(testUser1.id);
    expect(follows[0].following_id).toEqual(testUser2.id);
    expect(follows[0].created_at).toBeInstanceOf(Date);
  });

  it('should update follower counts', async () => {
    const input = {
      follower_id: testUser1.id,
      following_id: testUser2.id
    };

    await createFollow(input);

    // Check updated counts
    const followerUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser1.id))
      .execute();

    const followingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser2.id))
      .execute();

    expect(followerUser[0].following_count).toEqual(1);
    expect(followingUser[0].follower_count).toEqual(1);
  });

  it('should prevent self-follow', async () => {
    const input = {
      follower_id: testUser1.id,
      following_id: testUser1.id
    };

    await expect(createFollow(input)).rejects.toThrow(/cannot follow themselves/i);
  });

  it('should prevent duplicate follow relationships', async () => {
    const input = {
      follower_id: testUser1.id,
      following_id: testUser2.id
    };

    // Create first follow
    await createFollow(input);

    // Attempt duplicate follow
    await expect(createFollow(input)).rejects.toThrow(/already exists/i);
  });

  it('should throw error for non-existent follower', async () => {
    const input = {
      follower_id: 9999,
      following_id: testUser2.id
    };

    await expect(createFollow(input)).rejects.toThrow(/User with id 9999 does not exist/i);
  });

  it('should throw error for non-existent following user', async () => {
    const input = {
      follower_id: testUser1.id,
      following_id: 9999
    };

    await expect(createFollow(input)).rejects.toThrow(/User with id 9999 does not exist/i);
  });
});

describe('deleteFollow', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser1: any;
  let testUser2: any;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'follower_user',
          email: 'follower@test.com',
          display_name: 'Follower User',
          bio: 'I follow people',
          avatar_url: 'https://example.com/avatar1.jpg',
          is_verified: false,
          follower_count: 1,
          following_count: 1,
          post_count: 0
        },
        {
          username: 'following_user',
          email: 'following@test.com',
          display_name: 'Following User',
          bio: 'People follow me',
          avatar_url: 'https://example.com/avatar2.jpg',
          is_verified: true,
          follower_count: 1,
          following_count: 1,
          post_count: 0
        }
      ])
      .returning()
      .execute();

    testUser1 = users[0];
    testUser2 = users[1];

    // Create initial follow relationship
    await db.insert(followsTable)
      .values({
        follower_id: testUser1.id,
        following_id: testUser2.id
      })
      .execute();
  });

  it('should delete follow relationship', async () => {
    const result = await deleteFollow(testUser1.id, testUser2.id);

    expect(result).toBe(true);

    // Verify follow record is deleted
    const follows = await db.select()
      .from(followsTable)
      .where(
        and(
          eq(followsTable.follower_id, testUser1.id),
          eq(followsTable.following_id, testUser2.id)
        )
      )
      .execute();

    expect(follows).toHaveLength(0);
  });

  it('should update follower counts after deletion', async () => {
    await deleteFollow(testUser1.id, testUser2.id);

    // Check updated counts
    const followerUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser1.id))
      .execute();

    const followingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser2.id))
      .execute();

    expect(followerUser[0].following_count).toEqual(0);
    expect(followingUser[0].follower_count).toEqual(0);
  });

  it('should throw error when follow relationship does not exist', async () => {
    // Try to delete non-existent follow relationship
    await expect(deleteFollow(testUser2.id, testUser1.id)).rejects.toThrow(/does not exist/i);
  });
});