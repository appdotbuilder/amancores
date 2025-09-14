import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, listingsTable, usersTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq, and } from 'drizzle-orm';

// Test users for buyer and seller
const testBuyer = {
  username: 'test_buyer',
  email: 'buyer@test.com',
  display_name: 'Test Buyer',
  bio: null,
  avatar_url: null,
};

const testSeller = {
  username: 'test_seller',
  email: 'seller@test.com',
  display_name: 'Test Seller',
  bio: null,
  avatar_url: null,
};

// Test listing
const testListing = {
  title: 'Test Item',
  description: 'A test item for sale',
  price: '99.99',
  currency: 'USD',
  category: 'electronics',
  condition: 'new',
  location: 'New York',
  media_urls: null,
  is_active: true,
  view_count: 0,
};

describe('createTransaction', () => {
  let buyerId: number;
  let sellerId: number;
  let listingId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    sellerId = sellers[0].id;

    // Create test listing
    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: sellerId,
      })
      .returning()
      .execute();
    listingId = listings[0].id;
  });

  afterEach(resetDB);

  const createValidTransactionInput = (): CreateTransactionInput => ({
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: sellerId,
    amount: 99.99,
    currency: 'USD',
    payment_method: 'credit_card',
  });

  it('should create a transaction successfully', async () => {
    const input = createValidTransactionInput();
    const result = await createTransaction(input);

    // Basic field validation
    expect(result.listing_id).toEqual(listingId);
    expect(result.buyer_id).toEqual(buyerId);
    expect(result.seller_id).toEqual(sellerId);
    expect(result.amount).toEqual(99.99);
    expect(typeof result.amount).toEqual('number');
    expect(result.currency).toEqual('USD');
    expect(result.status).toEqual('pending');
    expect(result.payment_method).toEqual('credit_card');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save transaction to database', async () => {
    const input = createValidTransactionInput();
    const result = await createTransaction(input);

    // Query database to verify transaction was saved
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].listing_id).toEqual(listingId);
    expect(transactions[0].buyer_id).toEqual(buyerId);
    expect(transactions[0].seller_id).toEqual(sellerId);
    expect(parseFloat(transactions[0].amount)).toEqual(99.99);
    expect(transactions[0].currency).toEqual('USD');
    expect(transactions[0].status).toEqual('pending');
    expect(transactions[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle null payment method', async () => {
    const input = createValidTransactionInput();
    input.payment_method = null;
    
    const result = await createTransaction(input);

    expect(result.payment_method).toBeNull();
  });

  it('should ensure idempotency for duplicate transactions', async () => {
    const input = createValidTransactionInput();
    
    // Create first transaction
    const firstResult = await createTransaction(input);
    
    // Create second identical transaction
    const secondResult = await createTransaction(input);

    // Should return the same transaction
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.amount).toEqual(firstResult.amount);
    expect(secondResult.created_at).toEqual(firstResult.created_at);

    // Verify only one transaction exists in database
    const transactions = await db.select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.listing_id, listingId),
        eq(transactionsTable.buyer_id, buyerId)
      ))
      .execute();

    expect(transactions).toHaveLength(1);
  });

  it('should throw error for non-existent listing', async () => {
    const input = createValidTransactionInput();
    input.listing_id = 999999; // Non-existent listing ID

    await expect(createTransaction(input)).rejects.toThrow(/listing.*not found/i);
  });

  it('should throw error for inactive listing', async () => {
    // Make listing inactive
    await db.update(listingsTable)
      .set({ is_active: false })
      .where(eq(listingsTable.id, listingId))
      .execute();

    const input = createValidTransactionInput();

    await expect(createTransaction(input)).rejects.toThrow(/listing.*not active/i);
  });

  it('should throw error for non-existent buyer', async () => {
    const input = createValidTransactionInput();
    input.buyer_id = 999999; // Non-existent buyer ID

    await expect(createTransaction(input)).rejects.toThrow(/buyer.*not found/i);
  });

  it('should throw error for non-existent seller', async () => {
    const input = createValidTransactionInput();
    input.seller_id = 999999; // Non-existent seller ID

    await expect(createTransaction(input)).rejects.toThrow(/seller.*not found/i);
  });

  it('should throw error when buyer and seller are the same', async () => {
    const input = createValidTransactionInput();
    input.buyer_id = sellerId; // Same as seller

    await expect(createTransaction(input)).rejects.toThrow(/buyer and seller cannot be the same/i);
  });

  it('should throw error when seller is not listing owner', async () => {
    // Create another user
    const anotherUser = await db.insert(usersTable)
      .values({
        username: 'another_user',
        email: 'another@test.com',
        display_name: 'Another User',
        bio: null,
        avatar_url: null,
      })
      .returning()
      .execute();

    const input = createValidTransactionInput();
    input.seller_id = anotherUser[0].id; // Not the listing owner

    await expect(createTransaction(input)).rejects.toThrow(/seller must be the owner/i);
  });

  it('should throw error for amount mismatch', async () => {
    const input = createValidTransactionInput();
    input.amount = 199.99; // Different from listing price

    await expect(createTransaction(input)).rejects.toThrow(/amount must match listing price/i);
  });

  it('should throw error for currency mismatch', async () => {
    const input = createValidTransactionInput();
    input.currency = 'EUR'; // Different from listing currency

    await expect(createTransaction(input)).rejects.toThrow(/currency must match listing currency/i);
  });

  it('should handle decimal amounts correctly', async () => {
    // Update listing with decimal price
    await db.update(listingsTable)
      .set({ price: '123.45' })
      .where(eq(listingsTable.id, listingId))
      .execute();

    const input = createValidTransactionInput();
    input.amount = 123.45;

    const result = await createTransaction(input);

    expect(result.amount).toEqual(123.45);
    expect(typeof result.amount).toEqual('number');
  });

  it('should handle different payment methods', async () => {
    const paymentMethods = ['credit_card', 'paypal', 'bank_transfer', 'crypto'];

    for (const method of paymentMethods) {
      // Create a new listing for each test to avoid idempotency conflicts
      const newListing = await db.insert(listingsTable)
        .values({
          ...testListing,
          user_id: sellerId,
          title: `Test Item ${method}`,
        })
        .returning()
        .execute();

      const input = createValidTransactionInput();
      input.listing_id = newListing[0].id;
      input.payment_method = method;

      const result = await createTransaction(input);
      expect(result.payment_method).toEqual(method);
    }
  });
});