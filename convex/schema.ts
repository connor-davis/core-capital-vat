import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import users from './users';
import { qaResultValidator } from './validators';

export default defineSchema({
  users,
  videos: defineTable({
    userId: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    sourceStorageId: v.id('_storage'),
    status: v.union(
      v.literal('queued'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('deleted')
    ),
    googleFileUri: v.optional(v.string()),
    result: v.optional(qaResultValidator),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    sourceDeleteAfter: v.optional(v.number()),
    sourceDeletedAt: v.optional(v.number()),
    retainUntil: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_source_delete_after', ['sourceDeleteAfter'])
    .index('by_retain_until', ['retainUntil']),
});
