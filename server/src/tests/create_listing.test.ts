import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type CreateListingInput } from '../schema';
import { createListing } from '../handlers/create_listing';
import { eq } from 'drizzle-orm';

// Test user for creating listings
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: null,
  avatar_url: null,
};

// Simple test input
const testInput: CreateListingInput = {
  user_id: 1, // Will be set after user creation
  title: 'iPhone 14 Pro',
  description: 'Barely used iPhone 14 Pro in excellent condition with original box and charger.',
  price: 899.99,
  currency: 'USD',
  category: 'electronics',
  condition: 'like_new',
  location: 'San Francisco, CA',
  media_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
};

describe('createListing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a listing with all fields', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, user_id: userId };
    
    const result = await createListing(input);

    // Basic field validation
    expect(result.title).toEqual('iPhone 14 Pro');
    expect(result.description).toEqual(testInput.description);
    expect(result.price).toEqual(899.99);
    expect(typeof result.price).toBe('number'); // Verify numeric conversion
    expect(result.currency).toEqual('USD');
    expect(result.category).toEqual('electronics');
    expect(result.condition).toEqual('like_new');
    expect(result.location).toEqual('San Francisco, CA');
    expect(result.media_urls).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']);
    expect(result.user_id).toEqual(userId);
    expect(result.id).toBeDefined();
    expect(result.is_active).toBe(true);
    expect(result.view_count).toBe(0);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save listing to database correctly', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, user_id: userId };
    
    const result = await createListing(input);

    // Query database to verify saved data
    const listings = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, result.id))
      .execute();

    expect(listings).toHaveLength(1);
    const savedListing = listings[0];
    expect(savedListing.title).toEqual('iPhone 14 Pro');
    expect(savedListing.description).toEqual(testInput.description);
    expect(parseFloat(savedListing.price)).toEqual(899.99); // Verify stored as string
    expect(savedListing.currency).toEqual('USD');
    expect(savedListing.category).toEqual('electronics');
    expect(savedListing.condition).toEqual('like_new');
    expect(savedListing.location).toEqual('San Francisco, CA');
    expect(savedListing.media_urls).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']);
    expect(savedListing.is_active).toBe(true);
    expect(savedListing.view_count).toBe(0);
    expect(savedListing.created_at).toBeInstanceOf(Date);
    expect(savedListing.updated_at).toBeInstanceOf(Date);
  });

  it('should create listing with minimal required fields', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const minimalInput: CreateListingInput = {
      user_id: userId,
      title: 'Simple Item',
      description: 'A simple item for sale',
      price: 50.00,
      currency: 'USD',
      category: 'other',
      condition: 'good',
      location: null,
      media_urls: null,
    };
    
    const result = await createListing(minimalInput);

    expect(result.title).toEqual('Simple Item');
    expect(result.description).toEqual('A simple item for sale');
    expect(result.price).toEqual(50.00);
    expect(result.location).toBeNull();
    expect(result.media_urls).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.view_count).toBe(0);
  });

  it('should handle different price values correctly', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Test various price formats
    const testCases = [
      { price: 1.99, expected: 1.99 },
      { price: 100, expected: 100 },
      { price: 1234.56, expected: 1234.56 },
      { price: 0.01, expected: 0.01 },
    ];

    for (const testCase of testCases) {
      const input: CreateListingInput = {
        ...testInput,
        user_id: userId,
        title: `Test Item ${testCase.price}`,
        price: testCase.price,
      };

      const result = await createListing(input);
      expect(result.price).toEqual(testCase.expected);
      expect(typeof result.price).toBe('number');
    }
  });

  it('should handle different condition values', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const conditions = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

    for (const condition of conditions) {
      const input: CreateListingInput = {
        ...testInput,
        user_id: userId,
        title: `${condition} Item`,
        condition: condition,
      };

      const result = await createListing(input);
      expect(result.condition).toEqual(condition);
    }
  });

  it('should throw error when user does not exist', async () => {
    const input = { ...testInput, user_id: 999 }; // Non-existent user

    await expect(createListing(input)).rejects.toThrow(/User with id 999 does not exist/i);
  });

  it('should handle empty media_urls array', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input: CreateListingInput = {
      ...testInput,
      user_id: userId,
      media_urls: [],
    };
    
    const result = await createListing(input);
    expect(result.media_urls).toEqual([]);
  });

  it('should handle different currency codes', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

    for (const currency of currencies) {
      const input: CreateListingInput = {
        ...testInput,
        user_id: userId,
        title: `Item in ${currency}`,
        currency: currency,
      };

      const result = await createListing(input);
      expect(result.currency).toEqual(currency);
    }
  });
});