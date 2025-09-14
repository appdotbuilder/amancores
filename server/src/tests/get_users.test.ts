import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers, getUserById, getUserByUsername } from '../handlers/get_users';

// Test user data
const testUser1: CreateUserInput = {
  username: 'testuser1',
  email: 'test1@example.com',
  display_name: 'Test User One',
  bio: 'This is test user one',
  avatar_url: 'https://example.com/avatar1.jpg',
};

const testUser2: CreateUserInput = {
  username: 'TestUser2',
  email: 'test2@example.com',
  display_name: 'Test User Two',
  bio: null,
  avatar_url: null,
};

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const users = await getUsers();
    expect(users).toEqual([]);
  });

  it('should return all users', async () => {
    // Create test users
    await db.insert(usersTable)
      .values([
        {
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        },
        {
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        }
      ])
      .execute();

    const users = await getUsers();

    expect(users).toHaveLength(2);
    expect(users[0].username).toEqual('testuser1');
    expect(users[0].email).toEqual('test1@example.com');
    expect(users[0].display_name).toEqual('Test User One');
    expect(users[0].is_verified).toBe(false);
    expect(users[0].follower_count).toBe(0);
    expect(users[0].created_at).toBeInstanceOf(Date);

    expect(users[1].username).toEqual('TestUser2');
    expect(users[1].display_name).toEqual('Test User Two');
    expect(users[1].bio).toBeNull();
    expect(users[1].avatar_url).toBeNull();
  });
});

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when user does not exist', async () => {
    const user = await getUserById(999);
    expect(user).toBeNull();
  });

  it('should return user when found by ID', async () => {
    // Create test user
    const result = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const userId = result[0].id;
    const user = await getUserById(userId);

    expect(user).not.toBeNull();
    expect(user!.id).toBe(userId);
    expect(user!.username).toEqual('testuser1');
    expect(user!.email).toEqual('test1@example.com');
    expect(user!.display_name).toEqual('Test User One');
    expect(user!.bio).toEqual('This is test user one');
    expect(user!.avatar_url).toEqual('https://example.com/avatar1.jpg');
    expect(user!.is_verified).toBe(false);
    expect(user!.follower_count).toBe(0);
    expect(user!.following_count).toBe(0);
    expect(user!.post_count).toBe(0);
    expect(user!.created_at).toBeInstanceOf(Date);
    expect(user!.updated_at).toBeInstanceOf(Date);
  });
});

describe('getUserByUsername', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when user does not exist', async () => {
    const user = await getUserByUsername('nonexistent');
    expect(user).toBeNull();
  });

  it('should return user when found by username (case insensitive)', async () => {
    // Create test user
    await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .execute();

    // Test exact match
    const user1 = await getUserByUsername('testuser1');
    expect(user1).not.toBeNull();
    expect(user1!.username).toEqual('testuser1');

    // Test case insensitive match
    const user2 = await getUserByUsername('TESTUSER1');
    expect(user2).not.toBeNull();
    expect(user2!.username).toEqual('testuser1');

    // Test mixed case
    const user3 = await getUserByUsername('TestUser1');
    expect(user3).not.toBeNull();
    expect(user3!.username).toEqual('testuser1');
  });

  it('should handle usernames with different cases correctly', async () => {
    // Create test user with mixed case
    await db.insert(usersTable)
      .values({
        username: testUser2.username, // 'TestUser2'
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .execute();

    // Should find the user regardless of case
    const user1 = await getUserByUsername('testuser2');
    expect(user1).not.toBeNull();
    expect(user1!.username).toEqual('TestUser2');

    const user2 = await getUserByUsername('TESTUSER2');
    expect(user2).not.toBeNull();
    expect(user2!.username).toEqual('TestUser2');

    const user3 = await getUserByUsername('TestUser2');
    expect(user3).not.toBeNull();
    expect(user3!.username).toEqual('TestUser2');
  });
});