/**
 * One-time migration helpers for transitioning existing data to
 * organization-scoped ownership.
 *
 * Run from the Convex dashboard or CLI:
 *   npx convex run migrations:backfillVideos '{}'
 *
 * These mutations are idempotent — re-running them is safe.
 */
import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

/**
 * Backfill videos that still carry a legacy `userId` string
 * (the old tokenIdentifier-based ownership) by resolving the user
 * record and assigning the video to their current organization.
 *
 * Strategy:
 * 1. Find all videos missing `organizationId` (or where it is set
 *    but `createdByUserId` is missing).
 * 2. For each video, look up the user by their old `userId` string
 *    stored as `tokenIdentifier` in the users table.
 * 3. Assign the video to the user's current organization.
 *
 * If a user has no organization yet, the video is skipped and a
 * warning is logged.
 */
export const backfillVideos = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const allVideos = await ctx.db.query('videos').collect();

    let migrated = 0;
    let skipped = 0;
    const warnings: string[] = [];

    for (const video of allVideos) {
      // Already has both fields — nothing to do.
      if (video.organizationId && video.createdByUserId) {
        continue;
      }

      // The old schema stored `userId` as a plain string (tokenIdentifier).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legacyUserId = (video as any).userId as string | undefined;
      if (!legacyUserId) {
        warnings.push(
          `Video ${video._id} has no legacy userId and no organizationId — skipping.`
        );
        skipped++;
        continue;
      }

      // Find the user record by tokenIdentifier.
      const user = await ctx.db
        .query('users')
        .withIndex('by_token', (q) => q.eq('tokenIdentifier', legacyUserId))
        .unique();

      if (!user) {
        warnings.push(
          `Video ${video._id}: no user found for tokenIdentifier "${legacyUserId}" — skipping.`
        );
        skipped++;
        continue;
      }

      if (!user.organizationId) {
        warnings.push(
          `Video ${video._id}: user ${user._id} has no organizationId yet — skipping.`
        );
        skipped++;
        continue;
      }

      if (!dryRun) {
        await ctx.db.patch(video._id, {
          organizationId: user.organizationId,
          createdByUserId: user._id,
        });
      }
      migrated++;
    }

    const summary = {
      total: allVideos.length,
      migrated,
      skipped,
      dryRun,
      warnings,
    };

    console.log('backfillVideos result:', JSON.stringify(summary, null, 2));
    return summary;
  },
});
