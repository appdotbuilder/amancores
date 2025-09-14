import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, notificationsTable } from '../db/schema';
import { type CreateUserInput, type CreateNotificationInput } from '../schema';
import { getNotificationsByUserId, getUnreadNotificationCount, type GetNotificationsFilters } from '../handlers/get_notifications';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'Test bio',
  avatar_url: 'https://example.com/avatar.jpg'
};

const testUser2: CreateUserInput = {
  username: 'testuser2',
  email: 'test2@example.com',
  display_name: 'Test User 2',
  bio: 'Test bio 2',
  avatar_url: 'https://example.com/avatar2.jpg'
};

describe('getNotificationsByUserId', () => {
  let userId: number;
  let userId2: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    const userResult2 = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url
      })
      .returning()
      .execute();
    userId2 = userResult2[0].id;
  });

  afterEach(resetDB);

  it('should return empty array when user has no notifications', async () => {
    const result = await getNotificationsByUserId(userId);

    expect(result).toEqual([]);
  });

  it('should return user notifications ordered by creation date (newest first)', async () => {
    const notification1: CreateNotificationInput = {
      user_id: userId,
      type: 'like',
      title: 'First notification',
      message: 'You received a like',
      related_id: null
    };

    const notification2: CreateNotificationInput = {
      user_id: userId,
      type: 'follow',
      title: 'Second notification',
      message: 'Someone followed you',
      related_id: null
    };

    // Insert notifications with a small delay to ensure different timestamps
    await db.insert(notificationsTable)
      .values(notification1)
      .execute();
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await db.insert(notificationsTable)
      .values(notification2)
      .execute();

    const result = await getNotificationsByUserId(userId);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Second notification'); // More recent first
    expect(result[1].title).toBe('First notification');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should only return notifications for the specified user', async () => {
    const notification1: CreateNotificationInput = {
      user_id: userId,
      type: 'like',
      title: 'User 1 notification',
      message: 'Notification for user 1',
      related_id: null
    };

    const notification2: CreateNotificationInput = {
      user_id: userId2,
      type: 'follow',
      title: 'User 2 notification',
      message: 'Notification for user 2',
      related_id: null
    };

    await db.insert(notificationsTable)
      .values([notification1, notification2])
      .execute();

    const result = await getNotificationsByUserId(userId);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('User 1 notification');
    expect(result[0].user_id).toBe(userId);
  });

  it('should filter by read status when specified', async () => {
    const readNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'like',
      title: 'Read notification',
      message: 'This is read',
      related_id: null
    };

    const unreadNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'follow',
      title: 'Unread notification',
      message: 'This is unread',
      related_id: null
    };

    // Insert notifications
    const readResult = await db.insert(notificationsTable)
      .values(readNotification)
      .returning()
      .execute();

    await db.insert(notificationsTable)
      .values(unreadNotification)
      .execute();

    // Mark first notification as read
    await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.id, readResult[0].id))
      .execute();

    // Test filtering for read notifications
    const readResults = await getNotificationsByUserId(userId, { isRead: true });
    expect(readResults).toHaveLength(1);
    expect(readResults[0].title).toBe('Read notification');
    expect(readResults[0].is_read).toBe(true);

    // Test filtering for unread notifications
    const unreadResults = await getNotificationsByUserId(userId, { isRead: false });
    expect(unreadResults).toHaveLength(1);
    expect(unreadResults[0].title).toBe('Unread notification');
    expect(unreadResults[0].is_read).toBe(false);
  });

  it('should filter by notification type when specified', async () => {
    const likeNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'like',
      title: 'Like notification',
      message: 'You got a like',
      related_id: null
    };

    const followNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'follow',
      title: 'Follow notification',
      message: 'Someone followed you',
      related_id: null
    };

    await db.insert(notificationsTable)
      .values([likeNotification, followNotification])
      .execute();

    const likeResults = await getNotificationsByUserId(userId, { type: 'like' });
    expect(likeResults).toHaveLength(1);
    expect(likeResults[0].type).toBe('like');
    expect(likeResults[0].title).toBe('Like notification');

    const followResults = await getNotificationsByUserId(userId, { type: 'follow' });
    expect(followResults).toHaveLength(1);
    expect(followResults[0].type).toBe('follow');
    expect(followResults[0].title).toBe('Follow notification');
  });

  it('should handle pagination correctly', async () => {
    // Create 5 notifications
    const notifications = Array.from({ length: 5 }, (_, i) => ({
      user_id: userId,
      type: 'like',
      title: `Notification ${i + 1}`,
      message: `Message ${i + 1}`,
      related_id: null
    }));

    await db.insert(notificationsTable)
      .values(notifications)
      .execute();

    // Test first page
    const firstPage = await getNotificationsByUserId(userId, { limit: 2, offset: 0 });
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPage = await getNotificationsByUserId(userId, { limit: 2, offset: 2 });
    expect(secondPage).toHaveLength(2);

    // Test third page
    const thirdPage = await getNotificationsByUserId(userId, { limit: 2, offset: 4 });
    expect(thirdPage).toHaveLength(1);

    // Ensure no overlap between pages
    const firstPageIds = firstPage.map(n => n.id);
    const secondPageIds = secondPage.map(n => n.id);
    expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
  });

  it('should use default pagination values', async () => {
    // Create 60 notifications (more than default limit of 50)
    const notifications = Array.from({ length: 60 }, (_, i) => ({
      user_id: userId,
      type: 'like',
      title: `Notification ${i + 1}`,
      message: `Message ${i + 1}`,
      related_id: null
    }));

    await db.insert(notificationsTable)
      .values(notifications)
      .execute();

    const result = await getNotificationsByUserId(userId);
    expect(result).toHaveLength(50); // Should use default limit of 50
  });

  it('should combine multiple filters correctly', async () => {
    const readLikeNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'like',
      title: 'Read like notification',
      message: 'Read like message',
      related_id: null
    };

    const unreadLikeNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'like',
      title: 'Unread like notification',
      message: 'Unread like message',
      related_id: null
    };

    const readFollowNotification: CreateNotificationInput = {
      user_id: userId,
      type: 'follow',
      title: 'Read follow notification',
      message: 'Read follow message',
      related_id: null
    };

    // Insert notifications
    const readLikeResult = await db.insert(notificationsTable)
      .values(readLikeNotification)
      .returning()
      .execute();

    await db.insert(notificationsTable)
      .values([unreadLikeNotification, readFollowNotification])
      .execute();

    // Mark first notification as read
    await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.id, readLikeResult[0].id))
      .execute();

    // Filter for unread like notifications
    const result = await getNotificationsByUserId(userId, { 
      isRead: false, 
      type: 'like' 
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Unread like notification');
    expect(result[0].is_read).toBe(false);
    expect(result[0].type).toBe('like');
  });
});

describe('getUnreadNotificationCount', () => {
  let userId: number;
  let userId2: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    const userResult2 = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url
      })
      .returning()
      .execute();
    userId2 = userResult2[0].id;
  });

  afterEach(resetDB);

  it('should return 0 when user has no notifications', async () => {
    const count = await getUnreadNotificationCount(userId);
    expect(count).toBe(0);
  });

  it('should return correct count of unread notifications', async () => {
    const notifications = [
      {
        user_id: userId,
        type: 'like',
        title: 'Unread notification 1',
        message: 'Message 1',
        related_id: null
      },
      {
        user_id: userId,
        type: 'follow',
        title: 'Unread notification 2',
        message: 'Message 2',
        related_id: null
      },
      {
        user_id: userId,
        type: 'mention',
        title: 'Unread notification 3',
        message: 'Message 3',
        related_id: null
      }
    ];

    await db.insert(notificationsTable)
      .values(notifications)
      .execute();

    const count = await getUnreadNotificationCount(userId);
    expect(count).toBe(3);
  });

  it('should not count read notifications', async () => {
    const readNotification = {
      user_id: userId,
      type: 'like',
      title: 'Read notification',
      message: 'This is read',
      related_id: null
    };

    const unreadNotification = {
      user_id: userId,
      type: 'follow',
      title: 'Unread notification',
      message: 'This is unread',
      related_id: null
    };

    // Insert notifications
    const readResult = await db.insert(notificationsTable)
      .values(readNotification)
      .returning()
      .execute();

    await db.insert(notificationsTable)
      .values(unreadNotification)
      .execute();

    // Mark first notification as read
    await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.id, readResult[0].id))
      .execute();

    const count = await getUnreadNotificationCount(userId);
    expect(count).toBe(1); // Only the unread one should be counted
  });

  it('should only count notifications for the specified user', async () => {
    const notification1 = {
      user_id: userId,
      type: 'like',
      title: 'User 1 notification',
      message: 'For user 1',
      related_id: null
    };

    const notification2 = {
      user_id: userId2,
      type: 'follow',
      title: 'User 2 notification',
      message: 'For user 2',
      related_id: null
    };

    await db.insert(notificationsTable)
      .values([notification1, notification2])
      .execute();

    const count1 = await getUnreadNotificationCount(userId);
    const count2 = await getUnreadNotificationCount(userId2);

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it('should return 0 when all notifications are read', async () => {
    const notifications = [
      {
        user_id: userId,
        type: 'like',
        title: 'Notification 1',
        message: 'Message 1',
        related_id: null
      },
      {
        user_id: userId,
        type: 'follow',
        title: 'Notification 2',
        message: 'Message 2',
        related_id: null
      }
    ];

    const results = await db.insert(notificationsTable)
      .values(notifications)
      .returning()
      .execute();

    // Mark all notifications as read
    for (const notification of results) {
      await db.update(notificationsTable)
        .set({ is_read: true })
        .where(eq(notificationsTable.id, notification.id))
        .execute();
    }

    const count = await getUnreadNotificationCount(userId);
    expect(count).toBe(0);
  });

  it('should handle user with no notifications gracefully', async () => {
    // Test with a user ID that doesn't exist in notifications
    const count = await getUnreadNotificationCount(999);
    expect(count).toBe(0);
  });
});