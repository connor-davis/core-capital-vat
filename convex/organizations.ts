import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineTable({
  workosOrgId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_workos_org_id', ['workosOrgId']);
