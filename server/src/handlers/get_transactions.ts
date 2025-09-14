import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type Transaction } from '../schema';
import { eq, or } from 'drizzle-orm';

export const getTransactionById = async (id: number): Promise<Transaction | null> => {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    const transaction = results[0];
    return {
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert numeric to number
    };
  } catch (error) {
    console.error('Failed to get transaction by ID:', error);
    throw error;
  }
};

export const getTransactionsByUserId = async (userId: number): Promise<Transaction[]> => {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .where(
        or(
          eq(transactionsTable.buyer_id, userId),
          eq(transactionsTable.seller_id, userId)
        )
      )
      .execute();

    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert numeric to number
    }));
  } catch (error) {
    console.error('Failed to get transactions by user ID:', error);
    throw error;
  }
};

export const getTransactionsByListingId = async (listingId: number): Promise<Transaction[]> => {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.listing_id, listingId))
      .execute();

    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert numeric to number
    }));
  } catch (error) {
    console.error('Failed to get transactions by listing ID:', error);
    throw error;
  }
};