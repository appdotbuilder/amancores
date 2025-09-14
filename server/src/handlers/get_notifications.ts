import { db } from '../db';
import { notificationsTable } from '../db/schema';
import { type Notification } from '../schema';
import { eq, desc, and, SQL, count } from 'drizzle-orm';

export interface GetNotificationsFilters {
  isRead?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export const getNotificationsByUserId = async (
  userId: number,
  filters: GetNotificationsFilters = {}
): Promise<Notification[]> => {
  try {
    // Set default pagination values
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    // Always filter by user_id
    conditions.push(eq(notificationsTable.user_id, userId));

    // Add optional filters
    if (filters.isRead !== undefined) {
      conditions.push(eq(notificationsTable.is_read, filters.isRead));
    }

    if (filters.type) {
      conditions.push(eq(notificationsTable.type, filters.type));
    }

    // Build the complete query
    const query = db.select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.created_at))
      .limit(limit)
      .offset(offset);

    const results = await query.execute();

    // Return notifications with proper date handling
    return results.map(notification => ({
      ...notification,
      created_at: notification.created_at
    }));
  } catch (error) {
    console.error('Failed to get notifications:', error);
    throw error;
  }
};

export const getUnreadNotificationCount = async (userId: number): Promise<number> => {
  try {
    const result = await db.select({
      count: count()
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.user_id, userId),
        eq(notificationsTable.is_read, false)
      )
    )
    .execute();

    return result[0]?.count ?? 0;
  } catch (error) {
    console.error('Failed to get unread notification count:', error);
    throw error;
  }
};