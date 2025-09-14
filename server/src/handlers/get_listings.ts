import { db } from '../db';
import { listingsTable } from '../db/schema';
import { type Listing } from '../schema';
import { eq, and, ilike, gte, lte, desc, SQL, sql } from 'drizzle-orm';

export const getListings = async (filters?: {
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Listing[]> => {
  try {
    const conditions: SQL<unknown>[] = [];

    // Apply filters
    if (filters?.category) {
      conditions.push(eq(listingsTable.category, filters.category));
    }

    if (filters?.location) {
      conditions.push(ilike(listingsTable.location, `%${filters.location}%`));
    }

    if (filters?.minPrice !== undefined) {
      conditions.push(gte(listingsTable.price, filters.minPrice.toString()));
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(listingsTable.price, filters.maxPrice.toString()));
    }

    if (filters?.condition) {
      conditions.push(eq(listingsTable.condition, filters.condition));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(listingsTable.is_active, filters.isActive));
    }

    // Build query parts
    const selectQuery = db.select().from(listingsTable);
    const whereClause = conditions.length > 0 
      ? (conditions.length === 1 ? conditions[0] : and(...conditions))
      : undefined;

    // Execute query based on presence of filters and pagination
    let results;
    if (whereClause) {
      if (filters?.limit && filters?.offset) {
        results = await selectQuery
          .where(whereClause)
          .orderBy(desc(listingsTable.created_at))
          .limit(filters.limit)
          .offset(filters.offset)
          .execute();
      } else if (filters?.limit) {
        results = await selectQuery
          .where(whereClause)
          .orderBy(desc(listingsTable.created_at))
          .limit(filters.limit)
          .execute();
      } else if (filters?.offset) {
        results = await selectQuery
          .where(whereClause)
          .orderBy(desc(listingsTable.created_at))
          .offset(filters.offset)
          .execute();
      } else {
        results = await selectQuery
          .where(whereClause)
          .orderBy(desc(listingsTable.created_at))
          .execute();
      }
    } else {
      if (filters?.limit && filters?.offset) {
        results = await selectQuery
          .orderBy(desc(listingsTable.created_at))
          .limit(filters.limit)
          .offset(filters.offset)
          .execute();
      } else if (filters?.limit) {
        results = await selectQuery
          .orderBy(desc(listingsTable.created_at))
          .limit(filters.limit)
          .execute();
      } else if (filters?.offset) {
        results = await selectQuery
          .orderBy(desc(listingsTable.created_at))
          .offset(filters.offset)
          .execute();
      } else {
        results = await selectQuery
          .orderBy(desc(listingsTable.created_at))
          .execute();
      }
    }

    // Convert numeric fields back to numbers
    return results.map(listing => ({
      ...listing,
      price: parseFloat(listing.price)
    }));
  } catch (error) {
    console.error('Failed to fetch listings:', error);
    throw error;
  }
};

export const getListingById = async (id: number): Promise<Listing | null> => {
  try {
    // Increment view count
    await db.update(listingsTable)
      .set({
        view_count: sql`${listingsTable.view_count} + 1`,
        updated_at: new Date()
      })
      .where(eq(listingsTable.id, id))
      .execute();

    // Fetch the listing
    const results = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const listing = results[0];
    return {
      ...listing,
      price: parseFloat(listing.price)
    };
  } catch (error) {
    console.error('Failed to fetch listing by ID:', error);
    throw error;
  }
};

export const getListingsByUserId = async (
  userId: number,
  filters?: {
    isActive?: boolean;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Listing[]> => {
  try {
    const conditions: SQL<unknown>[] = [eq(listingsTable.user_id, userId)];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(listingsTable.is_active, filters.isActive));
    }

    if (filters?.category) {
      conditions.push(eq(listingsTable.category, filters.category));
    }

    const selectQuery = db.select().from(listingsTable);
    const whereClause = and(...conditions);

    // Execute query with pagination if needed
    let results;
    if (filters?.limit && filters?.offset) {
      results = await selectQuery
        .where(whereClause)
        .orderBy(desc(listingsTable.created_at))
        .limit(filters.limit)
        .offset(filters.offset)
        .execute();
    } else if (filters?.limit) {
      results = await selectQuery
        .where(whereClause)
        .orderBy(desc(listingsTable.created_at))
        .limit(filters.limit)
        .execute();
    } else if (filters?.offset) {
      results = await selectQuery
        .where(whereClause)
        .orderBy(desc(listingsTable.created_at))
        .offset(filters.offset)
        .execute();
    } else {
      results = await selectQuery
        .where(whereClause)
        .orderBy(desc(listingsTable.created_at))
        .execute();
    }

    // Convert numeric fields back to numbers
    return results.map(listing => ({
      ...listing,
      price: parseFloat(listing.price)
    }));
  } catch (error) {
    console.error('Failed to fetch listings by user ID:', error);
    throw error;
  }
};

export const searchListings = async (
  searchQuery: string,
  category?: string,
  location?: string
): Promise<Listing[]> => {
  try {
    const conditions: SQL<unknown>[] = [
      eq(listingsTable.is_active, true) // Only search active listings
    ];

    // Add search conditions for title and description
    if (searchQuery.trim()) {
      const searchCondition = sql`(
        ${listingsTable.title} ILIKE ${`%${searchQuery}%`} OR 
        ${listingsTable.description} ILIKE ${`%${searchQuery}%`}
      )`;
      conditions.push(searchCondition);
    }

    // Apply additional filters
    if (category) {
      conditions.push(eq(listingsTable.category, category));
    }

    if (location) {
      conditions.push(ilike(listingsTable.location, `%${location}%`));
    }

    const selectQuery = db.select().from(listingsTable);
    const whereClause = and(...conditions);

    // Execute query
    const results = await selectQuery
      .where(whereClause)
      .orderBy(desc(listingsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(listing => ({
      ...listing,
      price: parseFloat(listing.price)
    }));
  } catch (error) {
    console.error('Failed to search listings:', error);
    throw error;
  }
};