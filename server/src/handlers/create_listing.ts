import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type CreateListingInput, type Listing } from '../schema';
import { eq } from 'drizzle-orm';

export const createListing = async (input: CreateListingInput): Promise<Listing> => {
  try {
    // Verify that the user exists (foreign key validation)
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    // Insert listing record
    const result = await db.insert(listingsTable)
      .values({
        user_id: input.user_id,
        title: input.title,
        description: input.description,
        price: input.price.toString(), // Convert number to string for numeric column
        currency: input.currency,
        category: input.category,
        condition: input.condition,
        location: input.location,
        media_urls: input.media_urls
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const listing = result[0];
    return {
      ...listing,
      price: parseFloat(listing.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Listing creation failed:', error);
    throw error;
  }
};