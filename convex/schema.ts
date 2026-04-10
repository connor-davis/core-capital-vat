import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import organizations from './organizations';
import users from './users';
import { qaResultValidator, rubricCriterionValidator } from './validators';

export default defineSchema({
  organizations,
  users,
  rubrics: defineTable({
    organizationId: v.id('organizations'),
    criteria: v.array(rubricCriterionValidator),
    passingScore: v.number(),
    createdByUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_organization', ['organizationId']),
  videos: defineTable({
    organizationId: v.id('organizations'),
    createdByUserId: v.id('users'),
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
    rubricSnapshot: v.optional(
      v.object({
        criteria: v.array(rubricCriterionValidator),
        passingScore: v.number(),
      })
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    sourceDeleteAfter: v.optional(v.number()),
    sourceDeletedAt: v.optional(v.number()),
    retainUntil: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_status', ['status'])
    .index('by_source_delete_after', ['sourceDeleteAfter'])
    .index('by_retain_until', ['retainUntil']),
});
