import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, followsTable } from '../db/schema';
import { type CreateUserInput, type CreateFollowInput } from '../schema';
import { getFollowers, getFollowing, getFollowRelationship } from '../handlers/get_follows';

// Test user inputs
const testUser1: CreateUserInput = {
  username: 'follower1',
  email: 'follower1@test.com',
  display_name: 'Follower One',
  bio: 'First follower',
  avatar_url: null,
};

const testUser2: CreateUserInput = {
  username: 'followed1',
  email: 'followed1@test.com',
  display_name: 'Followed One',
  bio: 'First followed user',
  avatar_url: null,
};

const testUser3: CreateUserInput = {
  username: 'user3',
  email: 'user3@test.com',
  display_name: 'User Three',
  bio: 'Third user',
  avatar_url: null,
};

describe('getFollows', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getFollowers', () => {
    it('should return empty array when user has no followers', async () => {
      // Create a user with no followers
      const userResult = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const userId = userResult[0].id;
      const followers = await getFollowers(userId);

      expect(followers).toEqual([]);
    });

    it('should return followers for a user', async () => {
      // Create users
      const user1Result = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        })
        .returning()
        .execute();

      const followerId = user1Result[0].id;
      const followedId = user2Result[0].id;

      // Create follow relationship (user1 follows user2)
      await db.insert(followsTable)
        .values({
          follower_id: followerId,
          following_id: followedId,
        })
        .execute();

      // Get followers of user2 (should include user1)
      const followers = await getFollowers(followedId);

      expect(followers).toHaveLength(1);
      expect(followers[0].id).toEqual(followerId);
      expect(followers[0].username).toEqual(testUser1.username);
      expect(followers[0].display_name).toEqual(testUser1.display_name);
      expect(followers[0].email).toEqual(testUser1.email);
    });

    it('should return multiple followers', async () => {
      // Create three users
      const users = await Promise.all([
        db.insert(usersTable).values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        }).returning().execute(),
        db.insert(usersTable).values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        }).returning().execute(),
        db.insert(usersTable).values({
          username: testUser3.username,
          email: testUser3.email,
          display_name: testUser3.display_name,
          bio: testUser3.bio,
          avatar_url: testUser3.avatar_url,
        }).returning().execute(),
      ]);

      const user1Id = users[0][0].id;
      const user2Id = users[1][0].id;
      const user3Id = users[2][0].id;

      // Create follow relationships (user1 and user3 follow user2)
      await Promise.all([
        db.insert(followsTable).values({
          follower_id: user1Id,
          following_id: user2Id,
        }).execute(),
        db.insert(followsTable).values({
          follower_id: user3Id,
          following_id: user2Id,
        }).execute(),
      ]);

      // Get followers of user2
      const followers = await getFollowers(user2Id);

      expect(followers).toHaveLength(2);
      const followerIds = followers.map(f => f.id).sort();
      expect(followerIds).toEqual([user1Id, user3Id].sort());
    });
  });

  describe('getFollowing', () => {
    it('should return empty array when user follows nobody', async () => {
      // Create a user who follows nobody
      const userResult = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const userId = userResult[0].id;
      const following = await getFollowing(userId);

      expect(following).toEqual([]);
    });

    it('should return users that a user follows', async () => {
      // Create users
      const user1Result = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        })
        .returning()
        .execute();

      const followerId = user1Result[0].id;
      const followedId = user2Result[0].id;

      // Create follow relationship (user1 follows user2)
      await db.insert(followsTable)
        .values({
          follower_id: followerId,
          following_id: followedId,
        })
        .execute();

      // Get users that user1 follows (should include user2)
      const following = await getFollowing(followerId);

      expect(following).toHaveLength(1);
      expect(following[0].id).toEqual(followedId);
      expect(following[0].username).toEqual(testUser2.username);
      expect(following[0].display_name).toEqual(testUser2.display_name);
      expect(following[0].email).toEqual(testUser2.email);
    });

    it('should return multiple followed users', async () => {
      // Create three users
      const users = await Promise.all([
        db.insert(usersTable).values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        }).returning().execute(),
        db.insert(usersTable).values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        }).returning().execute(),
        db.insert(usersTable).values({
          username: testUser3.username,
          email: testUser3.email,
          display_name: testUser3.display_name,
          bio: testUser3.bio,
          avatar_url: testUser3.avatar_url,
        }).returning().execute(),
      ]);

      const user1Id = users[0][0].id;
      const user2Id = users[1][0].id;
      const user3Id = users[2][0].id;

      // Create follow relationships (user1 follows user2 and user3)
      await Promise.all([
        db.insert(followsTable).values({
          follower_id: user1Id,
          following_id: user2Id,
        }).execute(),
        db.insert(followsTable).values({
          follower_id: user1Id,
          following_id: user3Id,
        }).execute(),
      ]);

      // Get users that user1 follows
      const following = await getFollowing(user1Id);

      expect(following).toHaveLength(2);
      const followingIds = following.map(f => f.id).sort();
      expect(followingIds).toEqual([user2Id, user3Id].sort());
    });
  });

  describe('getFollowRelationship', () => {
    it('should return null when no follow relationship exists', async () => {
      // Create two users with no follow relationship
      const user1Result = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        })
        .returning()
        .execute();

      const user1Id = user1Result[0].id;
      const user2Id = user2Result[0].id;

      const relationship = await getFollowRelationship(user1Id, user2Id);

      expect(relationship).toBeNull();
    });

    it('should return follow relationship when it exists', async () => {
      // Create users
      const user1Result = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        })
        .returning()
        .execute();

      const followerId = user1Result[0].id;
      const followedId = user2Result[0].id;

      // Create follow relationship
      const followResult = await db.insert(followsTable)
        .values({
          follower_id: followerId,
          following_id: followedId,
        })
        .returning()
        .execute();

      const followId = followResult[0].id;

      // Check if relationship exists
      const relationship = await getFollowRelationship(followerId, followedId);

      expect(relationship).not.toBeNull();
      expect(relationship!.id).toEqual(followId);
      expect(relationship!.follower_id).toEqual(followerId);
      expect(relationship!.following_id).toEqual(followedId);
      expect(relationship!.created_at).toBeInstanceOf(Date);
    });

    it('should return null for reverse relationship when only one-way follow exists', async () => {
      // Create users
      const user1Result = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        })
        .returning()
        .execute();

      const user1Id = user1Result[0].id;
      const user2Id = user2Result[0].id;

      // Create one-way follow relationship (user1 follows user2)
      await db.insert(followsTable)
        .values({
          follower_id: user1Id,
          following_id: user2Id,
        })
        .execute();

      // Check forward relationship (should exist)
      const forwardRelationship = await getFollowRelationship(user1Id, user2Id);
      expect(forwardRelationship).not.toBeNull();

      // Check reverse relationship (should not exist)
      const reverseRelationship = await getFollowRelationship(user2Id, user1Id);
      expect(reverseRelationship).toBeNull();
    });

    it('should handle bidirectional follows correctly', async () => {
      // Create users
      const user1Result = await db.insert(usersTable)
        .values({
          username: testUser1.username,
          email: testUser1.email,
          display_name: testUser1.display_name,
          bio: testUser1.bio,
          avatar_url: testUser1.avatar_url,
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          username: testUser2.username,
          email: testUser2.email,
          display_name: testUser2.display_name,
          bio: testUser2.bio,
          avatar_url: testUser2.avatar_url,
        })
        .returning()
        .execute();

      const user1Id = user1Result[0].id;
      const user2Id = user2Result[0].id;

      // Create bidirectional follow relationships
      await Promise.all([
        db.insert(followsTable).values({
          follower_id: user1Id,
          following_id: user2Id,
        }).execute(),
        db.insert(followsTable).values({
          follower_id: user2Id,
          following_id: user1Id,
        }).execute(),
      ]);

      // Both directions should return valid relationships
      const forwardRelationship = await getFollowRelationship(user1Id, user2Id);
      const reverseRelationship = await getFollowRelationship(user2Id, user1Id);

      expect(forwardRelationship).not.toBeNull();
      expect(reverseRelationship).not.toBeNull();
      expect(forwardRelationship!.follower_id).toEqual(user1Id);
      expect(forwardRelationship!.following_id).toEqual(user2Id);
      expect(reverseRelationship!.follower_id).toEqual(user2Id);
      expect(reverseRelationship!.following_id).toEqual(user1Id);
    });
  });
});