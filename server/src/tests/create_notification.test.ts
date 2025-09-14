import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { notificationsTable, usersTable } from '../db/schema';
import { type CreateNotificationInput } from '../schema';
import { createNotification, markNotificationAsRead, markAllNotificationsAsRead } from '../handlers/create_notification';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'Test bio',
  avatar_url: 'https://example.com/avatar.jpg',
};

// Test notification input
const testNotificationInput: CreateNotificationInput = {
  user_id: 1, // Will be set after user creation
  type: 'like',
  title: 'New Like',
  message: 'Someone liked your post',
  related_id: 123,
};

describe('createNotification', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a notification', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testNotificationInput, user_id: userId };

    const result = await createNotification(input);

    // Basic field validation
    expect(result.user_id).toBe(userId);
    expect(result.type).toBe('like');
    expect(result.title).toBe('New Like');
    expect(result.message).toBe('Someone liked your post');
    expect(result.related_id).toBe(123);
    expect(result.is_read).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save notification to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testNotificationInput, user_id: userId };

    const result = await createNotification(input);

    // Query database to verify notification was saved
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, result.id))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].user_id).toBe(userId);
    expect(notifications[0].type).toBe('like');
    expect(notifications[0].title).toBe('New Like');
    expect(notifications[0].message).toBe('Someone liked your post');
    expect(notifications[0].related_id).toBe(123);
    expect(notifications[0].is_read).toBe(false);
    expect(notifications[0].created_at).toBeInstanceOf(Date);
  });

  it('should create notification with null related_id', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input: CreateNotificationInput = {
      user_id: userId,
      type: 'follow',
      title: 'New Follower',
      message: 'Someone started following you',
      related_id: null,
    };

    const result = await createNotification(input);

    expect(result.related_id).toBe(null);
    expect(result.type).toBe('follow');
    expect(result.title).toBe('New Follower');
  });

  it('should handle different notification types', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const notificationTypes = ['like', 'follow', 'mention', 'reply', 'transaction'] as const;

    for (const type of notificationTypes) {
      const input: CreateNotificationInput = {
        user_id: userId,
        type,
        title: `Test ${type}`,
        message: `Test ${type} message`,
        related_id: 456,
      };

      const result = await createNotification(input);
      expect(result.type).toBe(type);
      expect(result.title).toBe(`Test ${type}`);
    }
  });

  it('should throw error for non-existent user', async () => {
    const input = { ...testNotificationInput, user_id: 999 };

    await expect(createNotification(input)).rejects.toThrow(/User with id 999 does not exist/i);
  });
});

describe('markNotificationAsRead', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should mark notification as read', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create test notification
    const notificationResult = await db.insert(notificationsTable)
      .values({
        user_id: userId,
        type: 'like',
        title: 'Test Notification',
        message: 'Test message',
        is_read: false,
        related_id: null,
      })
      .returning()
      .execute();

    const notificationId = notificationResult[0].id;

    // Mark as read
    const result = await markNotificationAsRead(notificationId);

    expect(result).toBe(true);

    // Verify in database
    const updatedNotification = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .execute();

    expect(updatedNotification[0].is_read).toBe(true);
  });

  it('should return false for non-existent notification', async () => {
    const result = await markNotificationAsRead(999);
    expect(result).toBe(false);
  });

  it('should handle already read notification', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create test notification that's already read
    const notificationResult = await db.insert(notificationsTable)
      .values({
        user_id: userId,
        type: 'like',
        title: 'Test Notification',
        message: 'Test message',
        is_read: true, // Already read
        related_id: null,
      })
      .returning()
      .execute();

    const notificationId = notificationResult[0].id;

    // Try to mark as read again
    const result = await markNotificationAsRead(notificationId);

    expect(result).toBe(true);

    // Verify it's still read
    const notification = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .execute();

    expect(notification[0].is_read).toBe(true);
  });
});

describe('markAllNotificationsAsRead', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should mark all user notifications as read', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create multiple test notifications
    await db.insert(notificationsTable)
      .values([
        {
          user_id: userId,
          type: 'like',
          title: 'Test Notification 1',
          message: 'Test message 1',
          is_read: false,
          related_id: null,
        },
        {
          user_id: userId,
          type: 'follow',
          title: 'Test Notification 2',
          message: 'Test message 2',
          is_read: false,
          related_id: null,
        },
        {
          user_id: userId,
          type: 'mention',
          title: 'Test Notification 3',
          message: 'Test message 3',
          is_read: true, // Already read
          related_id: null,
        },
      ])
      .execute();

    // Mark all as read
    const result = await markAllNotificationsAsRead(userId);

    expect(result).toBe(true);

    // Verify all notifications are marked as read
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, userId))
      .execute();

    expect(notifications).toHaveLength(3);
    notifications.forEach(notification => {
      expect(notification.is_read).toBe(true);
    });
  });

  it('should handle user with no notifications', async () => {
    // Create test user with no notifications
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const result = await markAllNotificationsAsRead(userId);

    expect(result).toBe(true);
  });

  it('should only affect target user notifications', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({ ...testUser, username: 'user1', email: 'user1@example.com' })
      .returning()
      .execute();
    
    const user2Result = await db.insert(usersTable)
      .values({ ...testUser, username: 'user2', email: 'user2@example.com' })
      .returning()
      .execute();
    
    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create notifications for both users
    await db.insert(notificationsTable)
      .values([
        {
          user_id: user1Id,
          type: 'like',
          title: 'User 1 Notification',
          message: 'Message for user 1',
          is_read: false,
          related_id: null,
        },
        {
          user_id: user2Id,
          type: 'follow',
          title: 'User 2 Notification',
          message: 'Message for user 2',
          is_read: false,
          related_id: null,
        },
      ])
      .execute();

    // Mark all notifications for user 1 as read
    await markAllNotificationsAsRead(user1Id);

    // Check user 1's notifications are read
    const user1Notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, user1Id))
      .execute();

    expect(user1Notifications[0].is_read).toBe(true);

    // Check user 2's notifications are still unread
    const user2Notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, user2Id))
      .execute();

    expect(user2Notifications[0].is_read).toBe(false);
  });

  it('should throw error for non-existent user', async () => {
    await expect(markAllNotificationsAsRead(999)).rejects.toThrow(/User with id 999 does not exist/i);
  });
});