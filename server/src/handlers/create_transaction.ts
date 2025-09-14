import { db } from '../db';
import { transactionsTable, listingsTable, usersTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createTransaction = async (input: CreateTransactionInput): Promise<Transaction> => {
  try {
    // Validate that listing exists and is active
    const listing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, input.listing_id))
      .execute();

    if (listing.length === 0) {
      throw new Error(`Listing with ID ${input.listing_id} not found`);
    }

    if (!listing[0].is_active) {
      throw new Error(`Listing with ID ${input.listing_id} is not active`);
    }

    // Validate that buyer exists
    const buyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.buyer_id))
      .execute();

    if (buyer.length === 0) {
      throw new Error(`Buyer with ID ${input.buyer_id} not found`);
    }

    // Validate that seller exists
    const seller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.seller_id))
      .execute();

    if (seller.length === 0) {
      throw new Error(`Seller with ID ${input.seller_id} not found`);
    }

    // Validate that buyer and seller are different
    if (input.buyer_id === input.seller_id) {
      throw new Error('Buyer and seller cannot be the same user');
    }

    // Validate that the seller is the owner of the listing
    if (listing[0].user_id !== input.seller_id) {
      throw new Error('Seller must be the owner of the listing');
    }

    // Validate that the amount matches the listing price
    const listingPrice = parseFloat(listing[0].price);
    if (Math.abs(input.amount - listingPrice) > 0.01) {
      throw new Error('Transaction amount must match listing price');
    }

    // Validate currency matches
    if (input.currency !== listing[0].currency) {
      throw new Error('Transaction currency must match listing currency');
    }

    // Check for existing pending transaction to ensure idempotency
    const existingTransaction = await db.select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.listing_id, input.listing_id),
        eq(transactionsTable.buyer_id, input.buyer_id),
        eq(transactionsTable.status, 'pending')
      ))
      .execute();

    if (existingTransaction.length > 0) {
      // Return existing transaction to maintain idempotency
      const transaction = existingTransaction[0];
      return {
        ...transaction,
        amount: parseFloat(transaction.amount) // Convert numeric to number
      };
    }

    // Insert new transaction
    const result = await db.insert(transactionsTable)
      .values({
        listing_id: input.listing_id,
        buyer_id: input.buyer_id,
        seller_id: input.seller_id,
        amount: input.amount.toString(), // Convert number to string for numeric column
        currency: input.currency,
        status: 'pending',
        payment_method: input.payment_method
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const transaction = result[0];
    return {
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};

export const updateTransactionStatus = async (id: number, status: string): Promise<Transaction> => {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is updating transaction status (confirmed, failed, etc.).
  // Should handle payment confirmations, refunds, and state transitions.
  // CRITICAL: Must maintain transaction integrity and audit trail.
  return Promise.resolve({
    id: id,
    listing_id: 1,
    buyer_id: 1,
    seller_id: 2,
    amount: 100.00,
    currency: 'USD',
    status: status,
    payment_method: 'credit_card',
    created_at: new Date(),
    updated_at: new Date(),
  } as Transaction);
};