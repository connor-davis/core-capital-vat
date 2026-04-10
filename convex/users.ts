import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineTable({
  tokenIdentifier: v.string(),
  workosUserId: v.optional(v.string()),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  organizationId: v.id('organizations'),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_token', ['tokenIdentifier'])
  .index('by_organization', ['organizationId']);
