import { v } from 'convex/values';

export const rubricCriterionValidator = v.object({
  id: v.number(),
  name: v.string(),
});

export const qaCriterionValidator = v.object({
  id: v.number(),
  name: v.string(),
  score: v.union(v.literal(0), v.literal(1), v.literal(2)),
  rationale: v.string(),
});

export const qaResultValidator = v.object({
  overallScore: v.number(),
  passed: v.boolean(),
  confidence: v.number(),
  criteria: v.array(qaCriterionValidator),
});
