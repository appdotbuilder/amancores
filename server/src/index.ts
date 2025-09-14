import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema, 
  updateUserInputSchema,
  createPostInputSchema,
  updatePostInputSchema,
  createListingInputSchema,
  updateListingInputSchema,
  createFollowInputSchema,
  createLikeInputSchema,
  createTransactionInputSchema,
  createNotificationInputSchema
} from './schema';

// Import handlers - Users
import { createUser } from './handlers/create_user';
import { getUsers, getUserById, getUserByUsername } from './handlers/get_users';
import { updateUser } from './handlers/update_user';

// Import handlers - Posts
import { createPost } from './handlers/create_post';
import { getPosts, getPostById, getPostsByUserId, getPostReplies } from './handlers/get_posts';
import { updatePost, deletePost } from './handlers/update_post';

// Import handlers - Listings
import { createListing } from './handlers/create_listing';
import { getListings, getListingById, getListingsByUserId, searchListings } from './handlers/get_listings';
import { updateListing, deactivateListing } from './handlers/update_listing';

// Import handlers - Social interactions
import { createFollow, deleteFollow } from './handlers/create_follow';
import { getFollowers, getFollowing, getFollowRelationship } from './handlers/get_follows';
import { createLike, deleteLike } from './handlers/create_like';

// Import handlers - Transactions
import { createTransaction, updateTransactionStatus } from './handlers/create_transaction';
import { getTransactionById, getTransactionsByUserId, getTransactionsByListingId } from './handlers/get_transactions';

// Import handlers - Notifications
import { createNotification, markNotificationAsRead, markAllNotificationsAsRead } from './handlers/create_notification';
import { getNotificationsByUserId, getUnreadNotificationCount } from './handlers/get_notifications';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  getUserById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getUserById(input.id)),

  getUserByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(({ input }) => getUserByUsername(input.username)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  // Post routes
  createPost: publicProcedure
    .input(createPostInputSchema)
    .mutation(({ input }) => createPost(input)),

  getPosts: publicProcedure
    .query(() => getPosts()),

  getPostById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getPostById(input.id)),

  getPostsByUserId: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getPostsByUserId(input.userId)),

  getPostReplies: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(({ input }) => getPostReplies(input.postId)),

  updatePost: publicProcedure
    .input(updatePostInputSchema)
    .mutation(({ input }) => updatePost(input)),

  deletePost: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePost(input.id)),

  // Listing routes
  createListing: publicProcedure
    .input(createListingInputSchema)
    .mutation(({ input }) => createListing(input)),

  getListings: publicProcedure
    .query(() => getListings()),

  getListingById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getListingById(input.id)),

  getListingsByUserId: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getListingsByUserId(input.userId)),

  searchListings: publicProcedure
    .input(z.object({ 
      query: z.string(),
      category: z.string().optional(),
      location: z.string().optional()
    }))
    .query(({ input }) => searchListings(input.query, input.category, input.location)),

  updateListing: publicProcedure
    .input(updateListingInputSchema)
    .mutation(({ input }) => updateListing(input)),

  deactivateListing: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deactivateListing(input.id)),

  // Social interaction routes
  createFollow: publicProcedure
    .input(createFollowInputSchema)
    .mutation(({ input }) => createFollow(input)),

  deleteFollow: publicProcedure
    .input(z.object({ followerId: z.number(), followingId: z.number() }))
    .mutation(({ input }) => deleteFollow(input.followerId, input.followingId)),

  getFollowers: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getFollowers(input.userId)),

  getFollowing: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getFollowing(input.userId)),

  getFollowRelationship: publicProcedure
    .input(z.object({ followerId: z.number(), followingId: z.number() }))
    .query(({ input }) => getFollowRelationship(input.followerId, input.followingId)),

  createLike: publicProcedure
    .input(createLikeInputSchema)
    .mutation(({ input }) => createLike(input)),

  deleteLike: publicProcedure
    .input(z.object({ userId: z.number(), postId: z.number() }))
    .mutation(({ input }) => deleteLike(input.userId, input.postId)),

  // Transaction routes
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  updateTransactionStatus: publicProcedure
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(({ input }) => updateTransactionStatus(input.id, input.status)),

  getTransactionById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getTransactionById(input.id)),

  getTransactionsByUserId: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getTransactionsByUserId(input.userId)),

  getTransactionsByListingId: publicProcedure
    .input(z.object({ listingId: z.number() }))
    .query(({ input }) => getTransactionsByListingId(input.listingId)),

  // Notification routes
  createNotification: publicProcedure
    .input(createNotificationInputSchema)
    .mutation(({ input }) => createNotification(input)),

  markNotificationAsRead: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => markNotificationAsRead(input.id)),

  markAllNotificationsAsRead: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ input }) => markAllNotificationsAsRead(input.userId)),

  getNotificationsByUserId: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getNotificationsByUserId(input.userId)),

  getUnreadNotificationCount: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUnreadNotificationCount(input.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      // Enable CORS for all routes
      cors({
        origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
        credentials: true,
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  
  server.listen(port);
  console.log(`🚀 Amancores TRPC API server listening at port: ${port}`);
  console.log(`📚 Health check available at: http://localhost:${port}/healthcheck`);
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});