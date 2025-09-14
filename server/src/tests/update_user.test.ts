import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type CreateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'Original bio',
  avatar_url: 'https://example.com/avatar.jpg',
};

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user display_name', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();

    const userId = created[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      display_name: 'Updated Display Name',
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.display_name).toEqual('Updated Display Name');
    expect(result.bio).toEqual('Original bio'); // Should remain unchanged
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user bio', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();

    const userId = created[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      bio: 'This is my updated bio with more details',
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.bio).toEqual('This is my updated bio with more details');
    expect(result.display_name).toEqual('Test User'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user avatar_url', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();

    const userId = created[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      avatar_url: 'https://newsite.com/newavatar.png',
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.avatar_url).toEqual('https://newsite.com/newavatar.png');
    expect(result.display_name).toEqual('Test User'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields at once', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();

    const userId = created[0].id;
    const originalUpdatedAt = created[0].updated_at;

    const updateInput: UpdateUserInput = {
      id: userId,
      display_name: 'Multi Update Name',
      bio: 'Multi update bio',
      avatar_url: 'https://multi.com/avatar.jpg',
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.display_name).toEqual('Multi Update Name');
    expect(result.bio).toEqual('Multi update bio');
    expect(result.avatar_url).toEqual('https://multi.com/avatar.jpg');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });

  it('should set nullable fields to null', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();

    const userId = created[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      display_name: null,
      bio: null,
      avatar_url: null,
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.display_name).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.avatar_url).toBeNull();
  });

  it('should save updated user to database', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
      })
      .returning()
      .execute();

    const userId = created[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      display_name: 'Database Check Name',
      bio: 'Database check bio',
    };

    await updateUser(updateInput);

    // Verify data was saved to database
    const savedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(savedUser).toHaveLength(1);
    expect(savedUser[0].display_name).toEqual('Database Check Name');
    expect(savedUser[0].bio).toEqual('Database check bio');
    expect(savedUser[0].avatar_url).toEqual('https://example.com/avatar.jpg'); // Should remain unchanged
  });

  it('should throw error for non-existent user', async () => {
    const updateInput: UpdateUserInput = {
      id: 99999, // Non-existent user ID
      display_name: 'Should Fail',
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should preserve non-updated fields correctly', async () => {
    // Create test user first
    const created = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url,
        is_verified: true, // Set to true to test preservation
        follower_count: 42,
        following_count: 24,
        post_count: 12,
      })
      .returning()
      .execute();

    const userId = created[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      bio: 'Only bio updated',
    };

    const result = await updateUser(updateInput);

    // Verify only bio changed, all other fields preserved
    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.bio).toEqual('Only bio updated');
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result.is_verified).toBe(true);
    expect(result.follower_count).toEqual(42);
    expect(result.following_count).toEqual(24);
    expect(result.post_count).toEqual(12);
  });
});