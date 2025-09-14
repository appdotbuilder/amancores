import { db } from '../db';
import { listingsTable } from '../db/schema';
import { type UpdateListingInput, type Listing } from '../schema';
import { eq } from 'drizzle-orm';

export const updateListing = async (input: UpdateListingInput): Promise<Listing> => {
  try {
    // First verify the listing exists
    const existingListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, input.id))
      .execute();

    if (existingListing.length === 0) {
      throw new Error(`Listing with id ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.price !== undefined) {
      updateData.price = input.price.toString(); // Convert number to string for numeric column
    }
    if (input.condition !== undefined) {
      updateData.condition = input.condition;
    }
    if (input.location !== undefined) {
      updateData.location = input.location;
    }
    if (input.media_urls !== undefined) {
      updateData.media_urls = input.media_urls;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update the listing
    const result = await db.update(listingsTable)
      .set(updateData)
      .where(eq(listingsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const listing = result[0];
    return {
      ...listing,
      price: parseFloat(listing.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Listing update failed:', error);
    throw error;
  }
};

export const deactivateListing = async (id: number): Promise<boolean> => {
  try {
    // First verify the listing exists
    const existingListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, id))
      .execute();

    if (existingListing.length === 0) {
      throw new Error(`Listing with id ${id} not found`);
    }

    // Update listing to inactive
    const result = await db.update(listingsTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(listingsTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Listing deactivation failed:', error);
    throw error;
  }
};