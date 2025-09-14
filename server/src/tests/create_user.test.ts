import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  username: 'testuser123',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'This is a test bio',
  avatar_url: 'https://example.com/avatar.jpg',
};

// Minimal test input with nullable fields as null
const minimalInput: CreateUserInput = {
  username: 'minimal_user',
  email: 'minimal@example.com',
  display_name: null,
  bio: null,
  avatar_url: null,
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser123');
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.bio).toEqual('This is a test bio');
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result.is_verified).toBe(false);
    expect(result.follower_count).toBe(0);
    expect(result.following_count).toBe(0);
    expect(result.post_count).toBe(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a user with minimal fields', async () => {
    const result = await createUser(minimalInput);

    // Basic field validation
    expect(result.username).toEqual('minimal_user');
    expect(result.email).toEqual('minimal@example.com');
    expect(result.display_name).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.avatar_url).toBeNull();
    expect(result.is_verified).toBe(false);
    expect(result.follower_count).toBe(0);
    expect(result.following_count).toBe(0);
    expect(result.post_count).toBe(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser123');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].display_name).toEqual('Test User');
    expect(users[0].bio).toEqual('This is a test bio');
    expect(users[0].avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(users[0].is_verified).toBe(false);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should enforce unique username constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same username
    const duplicateInput: CreateUserInput = {
      ...testInput,
      email: 'different@example.com',
    };

    expect(async () => {
      await createUser(duplicateInput);
    }).toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      username: 'different_username',
    };

    expect(async () => {
      await createUser(duplicateInput);
    }).toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should set default values correctly', async () => {
    const result = await createUser(minimalInput);

    // Verify default values are set
    expect(result.is_verified).toBe(false);
    expect(result.follower_count).toBe(0);
    expect(result.following_count).toBe(0);
    expect(result.post_count).toBe(0);
  });

  it('should generate sequential IDs', async () => {
    const user1 = await createUser({
      ...testInput,
      username: 'user1',
      email: 'user1@example.com',
    });

    const user2 = await createUser({
      ...testInput,
      username: 'user2',
      email: 'user2@example.com',
    });

    expect(user2.id).toBeGreaterThan(user1.id);
  });

  it('should create users with different timestamps', async () => {
    const user1 = await createUser({
      ...testInput,
      username: 'user1',
      email: 'user1@example.com',
    });

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const user2 = await createUser({
      ...testInput,
      username: 'user2',
      email: 'user2@example.com',
    });

    expect(user1.created_at).toBeInstanceOf(Date);
    expect(user2.created_at).toBeInstanceOf(Date);
    expect(user1.updated_at).toBeInstanceOf(Date);
    expect(user2.updated_at).toBeInstanceOf(Date);
  });
});