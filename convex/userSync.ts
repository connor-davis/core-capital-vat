import { ConvexError, v } from 'convex/values';

import { internalQuery, mutation } from './_generated/server';

export const syncUser = mutation({
  args: {
    workosOrgId: v.string(),
    orgName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError('Not authenticated.');
    }

    const now = Date.now();

    // Find or create the organization.
    let org = await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) =>
        q.eq('workosOrgId', args.workosOrgId)
      )
      .unique();

    if (!org) {
      const orgId = await ctx.db.insert('organizations', {
        workosOrgId: args.workosOrgId,
        name: args.orgName ?? 'Organization',
        createdAt: now,
        updatedAt: now,
      });
      org = (await ctx.db.get(orgId))!;
    }

    // Find or create/update the user record.
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_token', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier)
      )
      .unique();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        name: identity.name,
        email: identity.email,
        organizationId: org._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('users', {
        tokenIdentifier: identity.tokenIdentifier,
        workosUserId: identity.subject,
        email: identity.email,
        name: identity.name,
        organizationId: org._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

/** Internal query used by actions that cannot use authHelpers directly. */
export const getUserByToken = internalQuery({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('users')
      .withIndex('by_token', (q) =>
        q.eq('tokenIdentifier', args.tokenIdentifier)
      )
      .unique();
  },
});
