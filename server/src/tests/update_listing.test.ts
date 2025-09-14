import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type UpdateListingInput, type CreateUserInput } from '../schema';
import { updateListing, deactivateListing } from '../handlers/update_listing';
import { eq } from 'drizzle-orm';

// Test user for creating listings
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'A test user',
  avatar_url: 'https://example.com/avatar.jpg'
};

// Test listing data
const testListing = {
  user_id: 1, // Will be set after user creation
  title: 'Test Listing',
  description: 'A test listing for updating',
  price: '99.99', // Stored as string in database
  currency: 'USD',
  category: 'electronics',
  condition: 'good' as const,
  location: 'Test City',
  media_urls: ['https://example.com/image1.jpg'],
  is_active: true,
  view_count: 0
};

describe('updateListing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testListingId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: testUserId
      })
      .returning()
      .execute();
    testListingId = listingResult[0].id;
  });

  it('should update listing title', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      title: 'Updated Title'
    };

    const result = await updateListing(input);

    expect(result.id).toBe(testListingId);
    expect(result.title).toBe('Updated Title');
    expect(result.description).toBe('A test listing for updating'); // Should remain unchanged
    expect(result.price).toBe(99.99); // Should be converted to number
    expect(typeof result.price).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update listing description', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      description: 'Updated description with more details'
    };

    const result = await updateListing(input);

    expect(result.description).toBe('Updated description with more details');
    expect(result.title).toBe('Test Listing'); // Should remain unchanged
  });

  it('should update listing price with numeric conversion', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      price: 149.99
    };

    const result = await updateListing(input);

    expect(result.price).toBe(149.99);
    expect(typeof result.price).toBe('number');

    // Verify in database that it's stored as string
    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testListingId))
      .execute();
    
    expect(dbListing[0].price).toBe('149.99');
    expect(typeof dbListing[0].price).toBe('string');
  });

  it('should update listing condition', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      condition: 'like_new' as const
    };

    const result = await updateListing(input);

    expect(result.condition).toBe('like_new');
  });

  it('should update listing location', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      location: 'New City Location'
    };

    const result = await updateListing(input);

    expect(result.location).toBe('New City Location');
  });

  it('should update media URLs', async () => {
    const newMediaUrls = [
      'https://example.com/new-image1.jpg',
      'https://example.com/new-image2.jpg'
    ];

    const input: UpdateListingInput = {
      id: testListingId,
      media_urls: newMediaUrls
    };

    const result = await updateListing(input);

    expect(result.media_urls).toEqual(newMediaUrls);
  });

  it('should update listing status', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      is_active: false
    };

    const result = await updateListing(input);

    expect(result.is_active).toBe(false);
  });

  it('should handle null values for optional fields', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      location: null,
      media_urls: null
    };

    const result = await updateListing(input);

    expect(result.location).toBe(null);
    expect(result.media_urls).toBe(null);
  });

  it('should update multiple fields at once', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      title: 'Multi-Update Title',
      description: 'Multi-update description',
      price: 199.99,
      condition: 'new' as const,
      is_active: false
    };

    const result = await updateListing(input);

    expect(result.title).toBe('Multi-Update Title');
    expect(result.description).toBe('Multi-update description');
    expect(result.price).toBe(199.99);
    expect(result.condition).toBe('new');
    expect(result.is_active).toBe(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      title: 'Database Test Title',
      price: 299.99
    };

    await updateListing(input);

    // Verify changes were saved to database
    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testListingId))
      .execute();

    expect(dbListing).toHaveLength(1);
    expect(dbListing[0].title).toBe('Database Test Title');
    expect(parseFloat(dbListing[0].price)).toBe(299.99);
    expect(dbListing[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent listing', async () => {
    const input: UpdateListingInput = {
      id: 99999,
      title: 'Non-existent listing'
    };

    await expect(updateListing(input)).rejects.toThrow(/not found/i);
  });

  it('should preserve unchanged fields', async () => {
    const input: UpdateListingInput = {
      id: testListingId,
      title: 'Only Title Changed'
    };

    const result = await updateListing(input);

    // All other fields should remain unchanged
    expect(result.user_id).toBe(testUserId);
    expect(result.description).toBe('A test listing for updating');
    expect(result.price).toBe(99.99);
    expect(result.currency).toBe('USD');
    expect(result.category).toBe('electronics');
    expect(result.condition).toBe('good');
    expect(result.location).toBe('Test City');
    expect(result.is_active).toBe(true);
    expect(result.view_count).toBe(0);
  });
});

describe('deactivateListing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testListingId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({
        ...testListing,
        user_id: testUserId
      })
      .returning()
      .execute();
    testListingId = listingResult[0].id;
  });

  it('should deactivate an active listing', async () => {
    const result = await deactivateListing(testListingId);

    expect(result).toBe(true);

    // Verify listing is deactivated in database
    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testListingId))
      .execute();

    expect(dbListing[0].is_active).toBe(false);
    expect(dbListing[0].updated_at).toBeInstanceOf(Date);
  });

  it('should deactivate an already inactive listing', async () => {
    // First deactivate the listing
    await db.update(listingsTable)
      .set({ is_active: false })
      .where(eq(listingsTable.id, testListingId))
      .execute();

    const result = await deactivateListing(testListingId);

    expect(result).toBe(true);

    // Verify it remains inactive
    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testListingId))
      .execute();

    expect(dbListing[0].is_active).toBe(false);
  });

  it('should throw error for non-existent listing', async () => {
    await expect(deactivateListing(99999)).rejects.toThrow(/not found/i);
  });

  it('should update timestamp when deactivating', async () => {
    const beforeDeactivation = new Date();
    
    await deactivateListing(testListingId);

    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testListingId))
      .execute();

    expect(dbListing[0].updated_at).toBeInstanceOf(Date);
    expect(dbListing[0].updated_at.getTime()).toBeGreaterThanOrEqual(beforeDeactivation.getTime());
  });

  it('should preserve other fields when deactivating', async () => {
    await deactivateListing(testListingId);

    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testListingId))
      .execute();

    // All other fields should remain unchanged
    expect(dbListing[0].title).toBe('Test Listing');
    expect(dbListing[0].description).toBe('A test listing for updating');
    expect(dbListing[0].price).toBe('99.99');
    expect(dbListing[0].currency).toBe('USD');
    expect(dbListing[0].category).toBe('electronics');
    expect(dbListing[0].condition).toBe('good');
    expect(dbListing[0].location).toBe('Test City');
    expect(dbListing[0].view_count).toBe(0);
    expect(dbListing[0].user_id).toBe(testUserId);
  });
});