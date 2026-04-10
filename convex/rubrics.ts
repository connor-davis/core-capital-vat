import { ConvexError, v } from 'convex/values';

import { internalQuery, mutation, query } from './_generated/server';
import { getAuthContext, getOptionalAuthContext } from './authHelpers';
import { rubricCriterionValidator } from './validators';

/** The built-in rubric used when an organization has not uploaded a custom one. */
export const DEFAULT_RUBRIC_CRITERIA = [
  { id: 1, name: 'Lesson opening and expectations' },
  { id: 2, name: 'Warm-up and engagement' },
  { id: 3, name: 'Teacher energy and presence' },
  { id: 4, name: 'Rapport with the learner' },
  { id: 5, name: 'Pacing and time management' },
  { id: 6, name: 'Instruction clarity' },
  { id: 7, name: 'Concept checking' },
  { id: 8, name: 'Pronunciation modeling' },
  { id: 9, name: 'Error correction quality' },
  { id: 10, name: 'Student talk time balance' },
  { id: 11, name: 'Use of scaffolding' },
  { id: 12, name: 'Adaptation to learner level' },
  { id: 13, name: 'Use of visuals and gestures' },
  { id: 14, name: 'Classroom language accuracy' },
  { id: 15, name: 'Activity transition management' },
  { id: 16, name: 'Feedback specificity' },
  { id: 17, name: 'Checking for understanding' },
  { id: 18, name: 'Use of praise and encouragement' },
  { id: 19, name: 'Lesson objective completion' },
  { id: 20, name: 'Closing and recap' },
  { id: 21, name: 'Professionalism and compliance' },
] as const;

export const DEFAULT_PASSING_SCORE = 80;

/** Get the active rubric for the current user's organization. */
export const getForOrganization = query({
  args: {},
  handler: async (ctx) => {
    const authCtx = await getOptionalAuthContext(ctx);

    if (!authCtx) {
      return null;
    }

    const rubric = await ctx.db
      .query('rubrics')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', authCtx.organization._id)
      )
      .order('desc')
      .first();

    if (!rubric) {
      return {
        isDefault: true as const,
        criteria: DEFAULT_RUBRIC_CRITERIA as unknown as Array<{
          id: number;
          name: string;
        }>,
        passingScore: DEFAULT_PASSING_SCORE,
      };
    }

    return {
      isDefault: false as const,
      _id: rubric._id,
      criteria: rubric.criteria,
      passingScore: rubric.passingScore,
      updatedAt: rubric.updatedAt,
    };
  },
});

/** Save or update the rubric for the current user's organization. */
export const save = mutation({
  args: {
    criteria: v.array(rubricCriterionValidator),
    passingScore: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, organization } = await getAuthContext(ctx);

    if (args.criteria.length === 0) {
      throw new ConvexError('Rubric must include at least one criterion.');
    }

    if (args.passingScore < 0 || args.passingScore > 100) {
      throw new ConvexError('Passing score must be between 0 and 100.');
    }

    const now = Date.now();

    const existing = await ctx.db
      .query('rubrics')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', organization._id)
      )
      .order('desc')
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        criteria: args.criteria,
        passingScore: args.passingScore,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('rubrics', {
        organizationId: organization._id,
        criteria: args.criteria,
        passingScore: args.passingScore,
        createdByUserId: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

/** Internal query for use by the video processing action. */
export const getByOrganization = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('rubrics')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', args.organizationId)
      )
      .order('desc')
      .first();
  },
});
