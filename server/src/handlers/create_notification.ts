import { db } from '../db';
import { notificationsTable, usersTable } from '../db/schema';
import { type CreateNotificationInput, type Notification } from '../schema';
import { eq } from 'drizzle-orm';

export const createNotification = async (input: CreateNotificationInput): Promise<Notification> => {
  try {
    // First verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    // Insert notification record
    const result = await db.insert(notificationsTable)
      .values({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        message: input.message,
        is_read: false,
        related_id: input.related_id,
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (id: number): Promise<boolean> => {
  try {
    // Update the notification to mark it as read
    const result = await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.id, id))
      .returning()
      .execute();

    // Return true if a notification was updated, false otherwise
    return result.length > 0;
  } catch (error) {
    console.error('Mark notification as read failed:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: number): Promise<boolean> => {
  try {
    // First verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${userId} does not exist`);
    }

    // Update all unread notifications for the user
    await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.user_id, userId))
      .execute();

    return true;
  } catch (error) {
    console.error('Mark all notifications as read failed:', error);
    throw error;
  }
};