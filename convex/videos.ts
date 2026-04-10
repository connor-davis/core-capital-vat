import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { getAuthContext, getOptionalAuthContext } from './authHelpers';
import { qaResultValidator, rubricCriterionValidator } from './validators';

const SOURCE_FILE_RETENTION_HOURS = 6;
const REPORT_RETENTION_DAYS = 30;

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getAuthContext(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const createVideo = mutation({
  args: {
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    sourceStorageId: v.id('_storage'),
  },
  returns: v.id('videos'),
  handler: async (ctx, args) => {
    const { user, organization } = await getAuthContext(ctx);
    const now = Date.now();
    const retainUntil = now + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // Snapshot the organization's active rubric at upload time.
    const rubric = await ctx.db
      .query('rubrics')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', organization._id)
      )
      .order('desc')
      .first();

    const videoId = await ctx.db.insert('videos', {
      organizationId: organization._id,
      createdByUserId: user._id,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      sourceStorageId: args.sourceStorageId,
      status: 'queued',
      rubricSnapshot: rubric
        ? { criteria: rubric.criteria, passingScore: rubric.passingScore }
        : undefined,
      createdAt: now,
      updatedAt: now,
      retainUntil,
    });

    await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideo, {
      videoId,
    });

    return videoId;
  },
});

export const retryVideo = mutation({
  args: {
    videoId: v.id('videos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization } = await getAuthContext(ctx);
    const video = await ctx.db.get(args.videoId);

    if (!video || video.organizationId !== organization._id) {
      throw new ConvexError('The requested QA video could not be found.');
    }

    const now = Date.now();

    await ctx.db.patch(video._id, {
      status: 'queued',
      errorMessage: undefined,
      googleFileUri: undefined,
      result: undefined,
      processingStartedAt: undefined,
      completedAt: undefined,
      sourceDeleteAfter: undefined,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideo, {
      videoId: video._id,
    });

    return null;
  },
});

export const listForViewer = query({
  args: {},
  handler: async (ctx) => {
    const authCtx = await getOptionalAuthContext(ctx);

    if (!authCtx) {
      return [];
    }

    return ctx.db
      .query('videos')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', authCtx.organization._id)
      )
      .order('desc')
      .collect();
  },
});

export const getForViewer = query({
  args: {
    videoId: v.id('videos'),
  },
  handler: async (ctx, args) => {
    const authCtx = await getOptionalAuthContext(ctx);

    if (!authCtx) {
      return null;
    }

    const video = await ctx.db.get(args.videoId);

    if (!video || video.organizationId !== authCtx.organization._id) {
      throw new ConvexError('The requested QA video could not be found.');
    }

    const sourceUrl =
      video.sourceDeletedAt === undefined
        ? await ctx.storage.getUrl(video.sourceStorageId)
        : null;

    return {
      ...video,
      sourceUrl,
    };
  },
});

export const getVideoForProcessing = internalQuery({
  args: {
    videoId: v.id('videos'),
  },
  handler: async (ctx, args) => ctx.db.get(args.videoId),
});

export const listSourceDeletionCandidates = internalQuery({
  args: {
    now: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('videos')
      .withIndex('by_source_delete_after', (q) =>
        q.lte('sourceDeleteAfter', args.now)
      )
      .take(args.limit);

    return results.filter(
      (video) =>
        video.sourceDeleteAfter !== undefined &&
        video.sourceDeletedAt === undefined &&
        video.status !== 'deleted'
    );
  },
});

export const listExpiredVideos = internalQuery({
  args: {
    now: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('videos')
      .withIndex('by_retain_until', (q) => q.lte('retainUntil', args.now))
      .take(args.limit);

    return results.filter((video) => video.status !== 'deleted');
  },
});

export const markProcessing = internalMutation({
  args: {
    videoId: v.id('videos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.videoId, {
      status: 'processing',
      errorMessage: undefined,
      processingStartedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

export const markCompleted = internalMutation({
  args: {
    videoId: v.id('videos'),
    googleFileUri: v.string(),
    result: qaResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.videoId, {
      status: 'completed',
      googleFileUri: args.googleFileUri,
      result: args.result,
      completedAt: now,
      sourceDeleteAfter: now + SOURCE_FILE_RETENTION_HOURS * 60 * 60 * 1000,
      updatedAt: now,
    });

    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    videoId: v.id('videos'),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.videoId, {
      status: 'failed',
      errorMessage: args.errorMessage,
      completedAt: now,
      sourceDeleteAfter: now + SOURCE_FILE_RETENTION_HOURS * 60 * 60 * 1000,
      updatedAt: now,
    });

    return null;
  },
});

export const markSourceDeleted = internalMutation({
  args: {
    videoId: v.id('videos'),
    deletedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      sourceDeletedAt: args.deletedAt,
      updatedAt: args.deletedAt,
    });

    return null;
  },
});

export const deleteVideoRecord = internalMutation({
  args: {
    videoId: v.id('videos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.videoId);
    return null;
  },
});
