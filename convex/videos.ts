import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { qaResultValidator } from './validators';

const SOURCE_FILE_RETENTION_HOURS = 6;
const REPORT_RETENTION_DAYS = 30;

type AuthContext = {
  auth: {
    getUserIdentity(): Promise<{ tokenIdentifier: string } | null>;
  };
};

async function getIdentityOrThrow(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError('You must be signed in to manage QA videos.');
  }

  return identity;
}

function ensureViewerAccess(video: Doc<'videos'> | null, userId: string) {
  if (!video || video.userId !== userId) {
    throw new ConvexError('The requested QA video could not be found.');
  }

  return video;
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getIdentityOrThrow(ctx);
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
    const identity = await getIdentityOrThrow(ctx);
    const now = Date.now();
    const retainUntil = now + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const videoId = await ctx.db.insert('videos', {
      userId: identity.tokenIdentifier,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      sourceStorageId: args.sourceStorageId,
      status: 'queued',
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
    const identity = await getIdentityOrThrow(ctx);
    const video = ensureViewerAccess(
      await ctx.db.get(args.videoId),
      identity.tokenIdentifier
    );
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
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return [];
    }

    return ctx.db
      .query('videos')
      .withIndex('by_user', (q) => q.eq('userId', identity.tokenIdentifier))
      .order('desc')
      .collect();
  },
});

export const getForViewer = query({
  args: {
    videoId: v.id('videos'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const video = ensureViewerAccess(
      await ctx.db.get(args.videoId),
      identity.tokenIdentifier
    );
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
