import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  varchar,
  jsonb,
  index,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  display_name: varchar('display_name', { length: 100 }),
  bio: text('bio'),
  avatar_url: text('avatar_url'),
  is_verified: boolean('is_verified').default(false).notNull(),
  follower_count: integer('follower_count').default(0).notNull(),
  following_count: integer('following_count').default(0).notNull(),
  post_count: integer('post_count').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index('username_idx').on(table.username),
  emailIdx: index('email_idx').on(table.email),
}));

// Posts table
export const postsTable = pgTable('posts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  content: text('content').notNull(),
  media_urls: jsonb('media_urls').$type<string[]>(),
  like_count: integer('like_count').default(0).notNull(),
  repost_count: integer('repost_count').default(0).notNull(),
  reply_count: integer('reply_count').default(0).notNull(),
  is_pinned: boolean('is_pinned').default(false).notNull(),
  parent_post_id: integer('parent_post_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('posts_user_id_idx').on(table.user_id),
  parentPostIdIdx: index('posts_parent_post_id_idx').on(table.parent_post_id),
  createdAtIdx: index('posts_created_at_idx').on(table.created_at),
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
  parentPostFk: foreignKey({
    columns: [table.parent_post_id],
    foreignColumns: [table.id],
  }),
}));

// Listings table for marketplace
export const listingsTable = pgTable('listings', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  condition: varchar('condition', { length: 20 }).notNull(),
  location: varchar('location', { length: 100 }),
  media_urls: jsonb('media_urls').$type<string[]>(),
  is_active: boolean('is_active').default(true).notNull(),
  view_count: integer('view_count').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('listings_user_id_idx').on(table.user_id),
  categoryIdx: index('listings_category_idx').on(table.category),
  locationIdx: index('listings_location_idx').on(table.location),
  priceIdx: index('listings_price_idx').on(table.price),
  createdAtIdx: index('listings_created_at_idx').on(table.created_at),
  isActiveIdx: index('listings_is_active_idx').on(table.is_active),
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
}));

// Follows table for user relationships
export const followsTable = pgTable('follows', {
  id: serial('id').primaryKey(),
  follower_id: integer('follower_id').notNull(),
  following_id: integer('following_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  followerIdx: index('follows_follower_id_idx').on(table.follower_id),
  followingIdx: index('follows_following_id_idx').on(table.following_id),
  uniqueFollow: index('unique_follow_idx').on(table.follower_id, table.following_id),
  followerFk: foreignKey({
    columns: [table.follower_id],
    foreignColumns: [usersTable.id],
  }),
  followingFk: foreignKey({
    columns: [table.following_id],
    foreignColumns: [usersTable.id],
  }),
}));

// Likes table
export const likesTable = pgTable('likes', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  post_id: integer('post_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('likes_user_id_idx').on(table.user_id),
  postIdIdx: index('likes_post_id_idx').on(table.post_id),
  uniqueLike: index('unique_like_idx').on(table.user_id, table.post_id),
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
  postFk: foreignKey({
    columns: [table.post_id],
    foreignColumns: [postsTable.id],
  }),
}));

// Transactions table for marketplace
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  listing_id: integer('listing_id').notNull(),
  buyer_id: integer('buyer_id').notNull(),
  seller_id: integer('seller_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  payment_method: varchar('payment_method', { length: 50 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index('transactions_listing_id_idx').on(table.listing_id),
  buyerIdIdx: index('transactions_buyer_id_idx').on(table.buyer_id),
  sellerIdIdx: index('transactions_seller_id_idx').on(table.seller_id),
  statusIdx: index('transactions_status_idx').on(table.status),
  createdAtIdx: index('transactions_created_at_idx').on(table.created_at),
  listingFk: foreignKey({
    columns: [table.listing_id],
    foreignColumns: [listingsTable.id],
  }),
  buyerFk: foreignKey({
    columns: [table.buyer_id],
    foreignColumns: [usersTable.id],
  }),
  sellerFk: foreignKey({
    columns: [table.seller_id],
    foreignColumns: [usersTable.id],
  }),
}));

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  message: text('message').notNull(),
  is_read: boolean('is_read').default(false).notNull(),
  related_id: integer('related_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.user_id),
  typeIdx: index('notifications_type_idx').on(table.type),
  isReadIdx: index('notifications_is_read_idx').on(table.is_read),
  createdAtIdx: index('notifications_created_at_idx').on(table.created_at),
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
}));

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
  listings: many(listingsTable),
  followers: many(followsTable, { relationName: 'follower' }),
  following: many(followsTable, { relationName: 'following' }),
  likes: many(likesTable),
  buyerTransactions: many(transactionsTable, { relationName: 'buyer' }),
  sellerTransactions: many(transactionsTable, { relationName: 'seller' }),
  notifications: many(notificationsTable),
}));

export const postsRelations = relations(postsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [postsTable.user_id],
    references: [usersTable.id],
  }),
  parentPost: one(postsTable, {
    fields: [postsTable.parent_post_id],
    references: [postsTable.id],
    relationName: 'parentPost',
  }),
  replies: many(postsTable, { relationName: 'parentPost' }),
  likes: many(likesTable),
}));

export const listingsRelations = relations(listingsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [listingsTable.user_id],
    references: [usersTable.id],
  }),
  transactions: many(transactionsTable),
}));

export const followsRelations = relations(followsTable, ({ one }) => ({
  follower: one(usersTable, {
    fields: [followsTable.follower_id],
    references: [usersTable.id],
    relationName: 'follower',
  }),
  following: one(usersTable, {
    fields: [followsTable.following_id],
    references: [usersTable.id],
    relationName: 'following',
  }),
}));

export const likesRelations = relations(likesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [likesTable.user_id],
    references: [usersTable.id],
  }),
  post: one(postsTable, {
    fields: [likesTable.post_id],
    references: [postsTable.id],
  }),
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  listing: one(listingsTable, {
    fields: [transactionsTable.listing_id],
    references: [listingsTable.id],
  }),
  buyer: one(usersTable, {
    fields: [transactionsTable.buyer_id],
    references: [usersTable.id],
    relationName: 'buyer',
  }),
  seller: one(usersTable, {
    fields: [transactionsTable.seller_id],
    references: [usersTable.id],
    relationName: 'seller',
  }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.user_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;
export type Listing = typeof listingsTable.$inferSelect;
export type NewListing = typeof listingsTable.$inferInsert;
export type Follow = typeof followsTable.$inferSelect;
export type NewFollow = typeof followsTable.$inferInsert;
export type Like = typeof likesTable.$inferSelect;
export type NewLike = typeof likesTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  posts: postsTable,
  listings: listingsTable,
  follows: followsTable,
  likes: likesTable,
  transactions: transactionsTable,
  notifications: notificationsTable,
};