import { ConvexError } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

export type AuthenticatedContext = {
  user: Doc<'users'>;
  organization: Doc<'organizations'>;
};

/**
 * Resolves the authenticated user and their active organization from the
 * Convex auth context. Throws if the user is not signed in, their user
 * record has not been synced yet, or the organization record is missing.
 */
export async function getAuthContext(
  ctx: QueryCtx
): Promise<AuthenticatedContext> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError('You must be signed in.');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_token', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier)
    )
    .unique();

  if (!user) {
    throw new ConvexError(
      'User record not found. Please sign in with an organization.'
    );
  }

  const organization = await ctx.db.get(user.organizationId);

  if (!organization) {
    throw new ConvexError('Organization not found.');
  }

  return { user, organization };
}

/**
 * Like {@link getAuthContext} but returns `null` instead of throwing when
 * the user is unauthenticated or the records are missing.
 */
export async function getOptionalAuthContext(
  ctx: QueryCtx
): Promise<AuthenticatedContext | null> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_token', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier)
    )
    .unique();

  if (!user) {
    return null;
  }

  const organization = await ctx.db.get(user.organizationId);

  if (!organization) {
    return null;
  }

  return { user, organization };
}
