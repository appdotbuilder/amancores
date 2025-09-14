import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type CreateUserInput, type CreateListingInput } from '../schema';
import { getListings, getListingById, getListingsByUserId, searchListings } from '../handlers/get_listings';
import { eq } from 'drizzle-orm';

// Test data
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

const testListing: CreateListingInput = {
  user_id: 1, // Will be set after user creation
  title: 'Test iPhone 15',
  description: 'Brand new iPhone 15 in excellent condition',
  price: 999.99,
  currency: 'USD',
  category: 'electronics',
  condition: 'new',
  location: 'New York',
  media_urls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']
};

const testListing2: CreateListingInput = {
  user_id: 2, // Will be set after user creation
  title: 'Used MacBook Pro',
  description: 'MacBook Pro 2021 in good condition, some scratches',
  price: 1299.50,
  currency: 'USD',
  category: 'electronics',
  condition: 'good',
  location: 'Los Angeles',
  media_urls: ['https://example.com/macbook1.jpg']
};

const testListing3: CreateListingInput = {
  user_id: 1,
  title: 'Vintage Camera',
  description: 'Beautiful vintage camera for photography enthusiasts',
  price: 450.00,
  currency: 'USD',
  category: 'camera',
  condition: 'fair',
  location: 'New York',
  media_urls: null
};

describe('getListings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId1: number;
  let userId2: number;

  beforeEach(async () => {
    // Create test users
    const userResult1 = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url
      })
      .returning()
      .execute();
    userId1 = userResult1[0].id;

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

    // Create test listings with slight delays to ensure different timestamps
    await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: userId1,
        price: testListing.price.toString()
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(listingsTable)
      .values({
        ...testListing2,
        user_id: userId2,
        price: testListing2.price.toString()
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(listingsTable)
      .values({
        ...testListing3,
        user_id: userId1,
        price: testListing3.price.toString()
      })
      .execute();
  });

  it('should fetch all listings without filters', async () => {
    const result = await getListings();

    expect(result).toHaveLength(3);
    // Results should be ordered by created_at desc (most recent first)
    expect(result[0].title).toEqual('Vintage Camera'); // Most recent (third inserted)
    expect(result[0].price).toEqual(450.00);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].user_id).toEqual(userId1);
    expect(result[0].is_active).toBe(true);
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter by category', async () => {
    const result = await getListings({ category: 'electronics' });

    expect(result).toHaveLength(2);
    result.forEach(listing => {
      expect(listing.category).toEqual('electronics');
    });
  });

  it('should filter by location (case insensitive)', async () => {
    const result = await getListings({ location: 'new york' });

    expect(result).toHaveLength(2);
    result.forEach(listing => {
      expect(listing.location?.toLowerCase()).toContain('new york');
    });
  });

  it('should filter by price range', async () => {
    const result = await getListings({ 
      minPrice: 500, 
      maxPrice: 1000 
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15');
    expect(result[0].price).toEqual(999.99);
    expect(result[0].price).toBeGreaterThanOrEqual(500);
    expect(result[0].price).toBeLessThanOrEqual(1000);
  });

  it('should filter by condition', async () => {
    const result = await getListings({ condition: 'new' });

    expect(result).toHaveLength(1);
    expect(result[0].condition).toEqual('new');
    expect(result[0].title).toEqual('Test iPhone 15');
  });

  it('should apply multiple filters', async () => {
    const result = await getListings({ 
      category: 'electronics',
      condition: 'good',
      location: 'los angeles'
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Used MacBook Pro');
    expect(result[0].category).toEqual('electronics');
    expect(result[0].condition).toEqual('good');
    expect(result[0].location?.toLowerCase()).toContain('los angeles');
  });

  it('should apply pagination', async () => {
    const result = await getListings({ 
      limit: 2, 
      offset: 1 
    });

    expect(result).toHaveLength(2);
    // Should skip the first (most recent) listing
    expect(result[0].title).toEqual('Used MacBook Pro');
    expect(result[1].title).toEqual('Test iPhone 15');
  });

  it('should filter by active status', async () => {
    // First make one listing inactive
    await db.update(listingsTable)
      .set({ is_active: false })
      .where(eq(listingsTable.title, 'Test iPhone 15'))
      .execute();

    const activeResult = await getListings({ isActive: true });
    expect(activeResult).toHaveLength(2);

    const inactiveResult = await getListings({ isActive: false });
    expect(inactiveResult).toHaveLength(1);
    expect(inactiveResult[0].title).toEqual('Test iPhone 15');
  });
});

describe('getListingById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let listingId: number;

  beforeEach(async () => {
    // Create test user
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

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: userId,
        price: testListing.price.toString()
      })
      .returning()
      .execute();
    listingId = listingResult[0].id;
  });

  it('should fetch listing by ID', async () => {
    const result = await getListingById(listingId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(listingId);
    expect(result!.title).toEqual('Test iPhone 15');
    expect(result!.price).toEqual(999.99);
    expect(typeof result!.price).toBe('number');
    expect(result!.user_id).toEqual(userId);
    expect(result!.view_count).toEqual(1); // Should be incremented
  });

  it('should increment view count on fetch', async () => {
    // Fetch multiple times
    await getListingById(listingId);
    await getListingById(listingId);
    const result = await getListingById(listingId);

    expect(result!.view_count).toEqual(3);
  });

  it('should return null for non-existent listing', async () => {
    const result = await getListingById(999999);

    expect(result).toBeNull();
  });

  it('should update updated_at timestamp when incrementing view count', async () => {
    const originalListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listingId))
      .execute();

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    await getListingById(listingId);

    const updatedListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listingId))
      .execute();

    expect(updatedListing[0].updated_at.getTime()).toBeGreaterThan(
      originalListing[0].updated_at.getTime()
    );
  });
});

describe('getListingsByUserId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId1: number;
  let userId2: number;

  beforeEach(async () => {
    // Create test users
    const userResult1 = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url
      })
      .returning()
      .execute();
    userId1 = userResult1[0].id;

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

    // Create test listings with slight delays to ensure different timestamps
    await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: userId1,
        price: testListing.price.toString()
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(listingsTable)
      .values({
        ...testListing2,
        user_id: userId2,
        price: testListing2.price.toString()
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(listingsTable)
      .values({
        ...testListing3,
        user_id: userId1,
        price: testListing3.price.toString()
      })
      .execute();
  });

  it('should fetch listings by user ID', async () => {
    const result = await getListingsByUserId(userId1);

    expect(result).toHaveLength(2);
    result.forEach(listing => {
      expect(listing.user_id).toEqual(userId1);
    });
    expect(result[0].title).toEqual('Vintage Camera'); // Most recent first (third inserted)
    expect(result[1].title).toEqual('Test iPhone 15'); // Oldest (first inserted)
  });

  it('should filter by active status', async () => {
    // Make one listing inactive
    await db.update(listingsTable)
      .set({ is_active: false })
      .where(eq(listingsTable.title, 'Test iPhone 15'))
      .execute();

    const activeResult = await getListingsByUserId(userId1, { isActive: true });
    expect(activeResult).toHaveLength(1);
    expect(activeResult[0].title).toEqual('Vintage Camera');

    const inactiveResult = await getListingsByUserId(userId1, { isActive: false });
    expect(inactiveResult).toHaveLength(1);
    expect(inactiveResult[0].title).toEqual('Test iPhone 15');
  });

  it('should filter by category', async () => {
    const result = await getListingsByUserId(userId1, { category: 'electronics' });

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15');
    expect(result[0].category).toEqual('electronics');
  });

  it('should apply pagination', async () => {
    const result = await getListingsByUserId(userId1, { 
      limit: 1, 
      offset: 1 
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15'); // Second most recent for userId1
  });

  it('should return empty array for user with no listings', async () => {
    const result = await getListingsByUserId(999999);

    expect(result).toHaveLength(0);
  });
});

describe('searchListings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId1: number;
  let userId2: number;

  beforeEach(async () => {
    // Create test users
    const userResult1 = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        display_name: testUser.display_name,
        bio: testUser.bio,
        avatar_url: testUser.avatar_url
      })
      .returning()
      .execute();
    userId1 = userResult1[0].id;

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

    // Create test listings with slight delays to ensure different timestamps
    await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: userId1,
        price: testListing.price.toString()
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(listingsTable)
      .values({
        ...testListing2,
        user_id: userId2,
        price: testListing2.price.toString()
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(listingsTable)
      .values({
        ...testListing3,
        user_id: userId1,
        price: testListing3.price.toString()
      })
      .execute();
  });

  it('should search by title (case insensitive)', async () => {
    const result = await searchListings('iphone');

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15');
  });

  it('should search by description (case insensitive)', async () => {
    const result = await searchListings('photography');

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Vintage Camera');
  });

  it('should search both title and description', async () => {
    const result = await searchListings('macbook');

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Used MacBook Pro');
  });

  it('should combine search with category filter', async () => {
    const result = await searchListings('test', 'electronics');

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15');
    expect(result[0].category).toEqual('electronics');
  });

  it('should combine search with location filter', async () => {
    const result = await searchListings('test', undefined, 'new york');

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15');
  });

  it('should combine search with both category and location', async () => {
    const result = await searchListings('test', 'electronics', 'new york');

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test iPhone 15');
    expect(result[0].category).toEqual('electronics');
  });

  it('should only search active listings', async () => {
    // Make one listing inactive
    await db.update(listingsTable)
      .set({ is_active: false })
      .where(eq(listingsTable.title, 'Test iPhone 15'))
      .execute();

    const result = await searchListings('iphone');

    expect(result).toHaveLength(0); // Should not find inactive listing
  });

  it('should return empty array for no matches', async () => {
    const result = await searchListings('nonexistentproduct');

    expect(result).toHaveLength(0);
  });

  it('should return all active listings when search query is empty', async () => {
    const result = await searchListings('');

    expect(result).toHaveLength(3); // Should return all active listings
    expect(result[0].title).toEqual('Vintage Camera'); // Most recent first
  });

  it('should filter by category only', async () => {
    const result = await searchListings('', 'electronics');

    expect(result).toHaveLength(2); // iPhone and MacBook
    result.forEach(listing => {
      expect(listing.category).toEqual('electronics');
    });
  });
});