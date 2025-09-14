import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable } from '../db/schema';
import { type CreateUserInput, type CreateListingInput, type CreateTransactionInput } from '../schema';
import { getTransactionById, getTransactionsByUserId, getTransactionsByListingId } from '../handlers/get_transactions';

// Test data
const testUser1: CreateUserInput = {
  username: 'buyer_user',
  email: 'buyer@test.com',
  display_name: 'Test Buyer',
  bio: 'Test buyer user',
  avatar_url: null,
};

const testUser2: CreateUserInput = {
  username: 'seller_user',
  email: 'seller@test.com',
  display_name: 'Test Seller',
  bio: 'Test seller user',
  avatar_url: null,
};

const testListing: CreateListingInput = {
  user_id: 0, // Will be set after user creation
  title: 'Test Product',
  description: 'A product for testing',
  price: 99.99,
  currency: 'USD',
  category: 'electronics',
  condition: 'new',
  location: 'Test City',
  media_urls: ['https://example.com/image1.jpg'],
};

const testTransaction: CreateTransactionInput = {
  listing_id: 0, // Will be set after listing creation
  buyer_id: 0, // Will be set after user creation
  seller_id: 0, // Will be set after user creation
  amount: 99.99,
  currency: 'USD',
  payment_method: 'credit_card',
};

describe('getTransactionById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return transaction when found', async () => {
    // Create prerequisite data
    const [buyer] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    const [transaction] = await db.insert(transactionsTable)
      .values({
        ...testTransaction,
        listing_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        amount: testTransaction.amount.toString(),
      })
      .returning()
      .execute();

    const result = await getTransactionById(transaction.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(transaction.id);
    expect(result!.listing_id).toEqual(listing.id);
    expect(result!.buyer_id).toEqual(buyer.id);
    expect(result!.seller_id).toEqual(seller.id);
    expect(result!.amount).toEqual(99.99);
    expect(typeof result!.amount).toBe('number');
    expect(result!.currency).toEqual('USD');
    expect(result!.status).toEqual('pending'); // Default status
    expect(result!.payment_method).toEqual('credit_card');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when transaction not found', async () => {
    const result = await getTransactionById(999);
    expect(result).toBeNull();
  });

  it('should handle numeric amount conversion correctly', async () => {
    // Create prerequisite data
    const [buyer] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    // Test with decimal amount
    const [transaction] = await db.insert(transactionsTable)
      .values({
        ...testTransaction,
        listing_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        amount: '149.95', // String with decimals
      })
      .returning()
      .execute();

    const result = await getTransactionById(transaction.id);

    expect(result).not.toBeNull();
    expect(result!.amount).toEqual(149.95);
    expect(typeof result!.amount).toBe('number');
  });
});

describe('getTransactionsByUserId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return transactions where user is buyer', async () => {
    // Create prerequisite data
    const [buyer] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    await db.insert(transactionsTable)
      .values({
        ...testTransaction,
        listing_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        amount: testTransaction.amount.toString(),
      })
      .execute();

    const result = await getTransactionsByUserId(buyer.id);

    expect(result).toHaveLength(1);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].amount).toEqual(99.99);
    expect(typeof result[0].amount).toBe('number');
  });

  it('should return transactions where user is seller', async () => {
    // Create prerequisite data
    const [buyer] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    await db.insert(transactionsTable)
      .values({
        ...testTransaction,
        listing_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        amount: testTransaction.amount.toString(),
      })
      .execute();

    const result = await getTransactionsByUserId(seller.id);

    expect(result).toHaveLength(1);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].amount).toEqual(99.99);
    expect(typeof result[0].amount).toBe('number');
  });

  it('should return transactions for both buyer and seller roles', async () => {
    // Create test users
    const [user1] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [user3] = await db.insert(usersTable)
      .values({
        username: 'third_user',
        email: 'third@test.com',
        display_name: 'Third User',
        bio: null,
        avatar_url: null,
      })
      .returning()
      .execute();

    // Create listings
    const [listing1] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: user1.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    const [listing2] = await db.insert(listingsTable)
      .values({
        ...testListing,
        title: 'Another Product',
        user_id: user2.id,
        price: '149.99',
      })
      .returning()
      .execute();

    // Transaction 1: user1 as seller, user2 as buyer
    await db.insert(transactionsTable)
      .values({
        listing_id: listing1.id,
        buyer_id: user2.id,
        seller_id: user1.id,
        amount: '99.99',
        currency: 'USD',
        payment_method: 'credit_card',
      })
      .execute();

    // Transaction 2: user2 as seller, user1 as buyer
    await db.insert(transactionsTable)
      .values({
        listing_id: listing2.id,
        buyer_id: user1.id,
        seller_id: user2.id,
        amount: '149.99',
        currency: 'USD',
        payment_method: 'paypal',
      })
      .execute();

    const result = await getTransactionsByUserId(user1.id);

    expect(result).toHaveLength(2);
    
    // Check that user1 appears as both buyer and seller
    const asBuyer = result.find(t => t.buyer_id === user1.id);
    const asSeller = result.find(t => t.seller_id === user1.id);
    
    expect(asBuyer).toBeDefined();
    expect(asSeller).toBeDefined();
    expect(asBuyer!.amount).toEqual(149.99);
    expect(asSeller!.amount).toEqual(99.99);
  });

  it('should return empty array when no transactions found', async () => {
    const result = await getTransactionsByUserId(999);
    expect(result).toHaveLength(0);
  });
});

describe('getTransactionsByListingId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return transactions for a specific listing', async () => {
    // Create prerequisite data
    const [buyer] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    await db.insert(transactionsTable)
      .values({
        ...testTransaction,
        listing_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        amount: testTransaction.amount.toString(),
      })
      .execute();

    const result = await getTransactionsByListingId(listing.id);

    expect(result).toHaveLength(1);
    expect(result[0].listing_id).toEqual(listing.id);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].amount).toEqual(99.99);
    expect(typeof result[0].amount).toBe('number');
  });

  it('should return multiple transactions for the same listing', async () => {
    // Create prerequisite data
    const [buyer1] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [buyer2] = await db.insert(usersTable)
      .values({
        username: 'second_buyer',
        email: 'buyer2@test.com',
        display_name: 'Second Buyer',
        bio: null,
        avatar_url: null,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    // Create multiple transactions for the same listing
    await db.insert(transactionsTable)
      .values([
        {
          listing_id: listing.id,
          buyer_id: buyer1.id,
          seller_id: seller.id,
          amount: '99.99',
          currency: 'USD',
          payment_method: 'credit_card',
        },
        {
          listing_id: listing.id,
          buyer_id: buyer2.id,
          seller_id: seller.id,
          amount: '99.99',
          currency: 'USD',
          payment_method: 'paypal',
        },
      ])
      .execute();

    const result = await getTransactionsByListingId(listing.id);

    expect(result).toHaveLength(2);
    expect(result.every(t => t.listing_id === listing.id)).toBe(true);
    expect(result.every(t => t.seller_id === seller.id)).toBe(true);
    
    const buyerIds = result.map(t => t.buyer_id);
    expect(buyerIds).toContain(buyer1.id);
    expect(buyerIds).toContain(buyer2.id);
  });

  it('should return empty array when no transactions found for listing', async () => {
    const result = await getTransactionsByListingId(999);
    expect(result).toHaveLength(0);
  });

  it('should handle different transaction statuses', async () => {
    // Create prerequisite data
    const [buyer] = await db.insert(usersTable)
      .values({
        username: testUser1.username,
        email: testUser1.email,
        display_name: testUser1.display_name,
        bio: testUser1.bio,
        avatar_url: testUser1.avatar_url,
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        username: testUser2.username,
        email: testUser2.email,
        display_name: testUser2.display_name,
        bio: testUser2.bio,
        avatar_url: testUser2.avatar_url,
      })
      .returning()
      .execute();

    const [listing] = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: seller.id,
        price: testListing.price.toString(),
      })
      .returning()
      .execute();

    // Create transactions with different statuses
    await db.insert(transactionsTable)
      .values([
        {
          listing_id: listing.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          amount: '99.99',
          currency: 'USD',
          status: 'pending',
          payment_method: 'credit_card',
        },
        {
          listing_id: listing.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          amount: '99.99',
          currency: 'USD',
          status: 'completed',
          payment_method: 'paypal',
        },
      ])
      .execute();

    const result = await getTransactionsByListingId(listing.id);

    expect(result).toHaveLength(2);
    const statuses = result.map(t => t.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('completed');
  });
});