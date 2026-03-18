import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { internalAction } from './_generated/server';

export const cleanupSourceFiles = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{ deletedCount: number }> => {
    const now = Date.now();
    const videos: Array<Doc<'videos'>> = await ctx.runQuery(
      internal.videos.listSourceDeletionCandidates,
      {
        now,
        limit: args.limit ?? 25,
      }
    );

    for (const video of videos) {
      if (video.sourceDeletedAt !== undefined) {
        continue;
      }

      await ctx.storage.delete(video.sourceStorageId);
      await ctx.runMutation(internal.videos.markSourceDeleted, {
        videoId: video._id,
        deletedAt: now,
      });
    }

    return { deletedCount: videos.length };
  },
});

export const purgeExpiredReports = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{ deletedCount: number }> => {
    const videos: Array<Doc<'videos'>> = await ctx.runQuery(
      internal.videos.listExpiredVideos,
      {
        now: Date.now(),
        limit: args.limit ?? 50,
      }
    );

    for (const video of videos) {
      if (video.sourceDeletedAt === undefined) {
        await ctx.storage.delete(video.sourceStorageId);
      }

      await ctx.runMutation(internal.videos.deleteVideoRecord, {
        videoId: video._id,
      });
    }

    return { deletedCount: videos.length };
  },
});
