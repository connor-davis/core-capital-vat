import { z } from 'zod';

/** The built-in default rubric. Kept here for backwards-compat and seeding. */
export const RUBRIC_CRITERIA = [
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

export const VIDEO_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'deleted',
] as const;

export const PASSING_SCORE = 80;
export const SOURCE_FILE_RETENTION_HOURS = 6;
export const REPORT_RETENTION_DAYS = 30;
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';

export type RubricCriterion = { id: number; name: string };
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const qaCriterionSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  rationale: z.string().min(1),
});

export const qaResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  passed: z.boolean(),
  confidence: z.number().min(0).max(1),
  criteria: z.array(qaCriterionSchema),
});

export type QaCriterion = z.infer<typeof qaCriterionSchema>;
export type QaResult = z.infer<typeof qaResultSchema>;

/**
 * Build the Gemini system prompt using the given rubric criteria and passing
 * score. Falls back to the built-in default when no custom rubric is provided.
 */
export function buildQaSystemPrompt(
  fileName: string,
  rubricCriteria: ReadonlyArray<RubricCriterion> = RUBRIC_CRITERIA,
  passingScore: number = PASSING_SCORE
) {
  const maxScore = rubricCriteria.length * 2;

  const rubricLines = rubricCriteria
    .map(
      (criterion) =>
        `${criterion.id}. ${criterion.name} — score with 0, 1, or 2 only.`
    )
    .join('\n');

  return [
    'You are an expert QA Reviewer for online ESL teaching sessions.',
    `Evaluate the uploaded lesson recording "${fileName}" against the ${rubricCriteria.length}-point rubric below.`,
    '',
    'Scoring rules:',
    '1. Score every criterion with 0, 1, or 2 only.',
    '2. Use the rationale field to justify the score with evidence from the lesson.',
    '3. Set confidence between 0 and 1.',
    `4. Calculate overallScore as (sum(criteria scores) / ${maxScore}) * 100.`,
    `5. Set passed to true when overallScore is greater than or equal to ${passingScore}.`,
    '',
    'Rubric:',
    rubricLines,
    '',
    'Return only valid JSON with this shape:',
    JSON.stringify(
      {
        overallScore: 85,
        passed: true,
        confidence: 0.9,
        criteria: rubricCriteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          score: 2,
          rationale: 'Evidence-based explanation',
        })),
      },
      null,
      2
    ),
  ].join('\n');
}

export function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function formatOverallScore(score: number) {
  return `${Math.round(score)}%`;
}
