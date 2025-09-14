import { z } from 'zod';

// User schemas
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_verified: z.boolean(),
  follower_count: z.number().int(),
  following_count: z.number().int(),
  post_count: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  display_name: z.string().min(1).max(100).nullable(),
  bio: z.string().max(500).nullable(),
  avatar_url: z.string().url().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  display_name: z.string().min(1).max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Post schemas
export const postSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  content: z.string(),
  media_urls: z.array(z.string()).nullable(),
  like_count: z.number().int(),
  repost_count: z.number().int(),
  reply_count: z.number().int(),
  is_pinned: z.boolean(),
  parent_post_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Post = z.infer<typeof postSchema>;

export const createPostInputSchema = z.object({
  user_id: z.number(),
  content: z.string().min(1).max(280),
  media_urls: z.array(z.string().url()).nullable(),
  parent_post_id: z.number().nullable(),
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const updatePostInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1).max(280).optional(),
  is_pinned: z.boolean().optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

// Listing schemas
export const listingSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  currency: z.string(),
  category: z.string(),
  condition: z.string(),
  location: z.string().nullable(),
  media_urls: z.array(z.string()).nullable(),
  is_active: z.boolean(),
  view_count: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Listing = z.infer<typeof listingSchema>;

export const createListingInputSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  price: z.number().positive(),
  currency: z.string().length(3), // USD, EUR, etc.
  category: z.string(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  location: z.string().nullable(),
  media_urls: z.array(z.string().url()).nullable(),
});

export type CreateListingInput = z.infer<typeof createListingInputSchema>;

export const updateListingInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  price: z.number().positive().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  location: z.string().nullable().optional(),
  media_urls: z.array(z.string().url()).nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateListingInput = z.infer<typeof updateListingInputSchema>;

// Follow relationship schemas
export const followSchema = z.object({
  id: z.number(),
  follower_id: z.number(),
  following_id: z.number(),
  created_at: z.coerce.date(),
});

export type Follow = z.infer<typeof followSchema>;

export const createFollowInputSchema = z.object({
  follower_id: z.number(),
  following_id: z.number(),
});

export type CreateFollowInput = z.infer<typeof createFollowInputSchema>;

// Like schemas
export const likeSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  post_id: z.number(),
  created_at: z.coerce.date(),
});

export type Like = z.infer<typeof likeSchema>;

export const createLikeInputSchema = z.object({
  user_id: z.number(),
  post_id: z.number(),
});

export type CreateLikeInput = z.infer<typeof createLikeInputSchema>;

// Transaction schemas for marketplace
export const transactionSchema = z.object({
  id: z.number(),
  listing_id: z.number(),
  buyer_id: z.number(),
  seller_id: z.number(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  payment_method: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionInputSchema = z.object({
  listing_id: z.number(),
  buyer_id: z.number(),
  seller_id: z.number(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  payment_method: z.string().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Notification schemas
export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  related_id: z.number().nullable(),
  created_at: z.coerce.date(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  user_id: z.number(),
  type: z.enum(['like', 'follow', 'mention', 'reply', 'transaction']),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  related_id: z.number().nullable(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;