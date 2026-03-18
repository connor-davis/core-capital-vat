import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

type GeminiFile = {
  name: string;
  uri: string;
  mimeType?: string;
  state?: string | { name?: string };
};

type GeminiFilePayload = GeminiFile | { file?: GeminiFile };

declare const process: {
  env: Record<string, string | undefined>;
};

const RUBRIC_CRITERIA = [
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

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
const PASSING_SCORE = 80;
const MAX_RUBRIC_SCORE = RUBRIC_CRITERIA.length * 2;

type QaCriterion = {
  id: number;
  name: string;
  score: 0 | 1 | 2;
  rationale: string;
};

type QaResult = {
  overallScore: number;
  passed: boolean;
  confidence: number;
  criteria: Array<QaCriterion>;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown processing error occurred.';
}

function buildQaSystemPrompt(fileName: string) {
  const rubricLines = RUBRIC_CRITERIA.map(
    (criterion) =>
      `${criterion.id}. ${criterion.name} — score with 0, 1, or 2 only.`
  ).join('\n');

  return [
    'You are an expert QA Reviewer for online ESL teaching sessions.',
    `Evaluate the uploaded lesson recording "${fileName}" against the 21-point rubric below.`,
    '',
    'Scoring rules:',
    '1. Score every criterion with 0, 1, or 2 only.',
    '2. Use the rationale field to justify the score with evidence from the lesson.',
    '3. Set confidence between 0 and 1.',
    `4. Calculate overallScore as (sum(criteria scores) / ${MAX_RUBRIC_SCORE}) * 100.`,
    `5. Set passed to true when overallScore is greater than or equal to ${PASSING_SCORE}.`,
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
        criteria: RUBRIC_CRITERIA.map((criterion) => ({
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

function normalizeJsonResponse(payload: string) {
  const trimmed = payload.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
  }

  return trimmed;
}

function isGeminiFile(payload: GeminiFilePayload): payload is GeminiFile {
  return (
    'name' in payload &&
    typeof payload.name === 'string' &&
    'uri' in payload &&
    typeof payload.uri === 'string'
  );
}

function extractGeminiFile(payload: GeminiFilePayload): GeminiFile {
  if (isGeminiFile(payload)) {
    return payload;
  }

  if (!payload.file?.name || !payload.file.uri) {
    throw new Error('Gemini did not return a usable file reference.');
  }

  return payload.file;
}

function parseQaResult(payload: unknown): QaResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Gemini returned a non-object QA result.');
  }

  const result = payload as Record<string, unknown>;
  const { overallScore, passed, confidence, criteria } = result;

  if (
    typeof overallScore !== 'number' ||
    overallScore < 0 ||
    overallScore > 100
  ) {
    throw new Error('Gemini returned an invalid overall score.');
  }

  if (typeof passed !== 'boolean') {
    throw new Error('Gemini returned an invalid passed flag.');
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('Gemini returned an invalid confidence value.');
  }

  if (!Array.isArray(criteria) || criteria.length !== RUBRIC_CRITERIA.length) {
    throw new Error('Gemini returned an invalid criteria array.');
  }

  const normalizedCriteria = criteria.map<QaCriterion>((criterion, index) => {
    if (typeof criterion !== 'object' || criterion === null) {
      throw new Error(`Criterion ${index + 1} is not a valid object.`);
    }

    const candidate = criterion as Record<string, unknown>;

    const score = candidate.score;

    if (
      typeof candidate.id !== 'number' ||
      typeof candidate.name !== 'string' ||
      (score !== 0 && score !== 1 && score !== 2) ||
      typeof candidate.rationale !== 'string'
    ) {
      throw new Error(`Criterion ${index + 1} has an invalid shape.`);
    }

    return {
      id: candidate.id,
      name: candidate.name,
      score,
      rationale: candidate.rationale,
    };
  });

  return {
    overallScore,
    passed,
    confidence,
    criteria: normalizedCriteria,
  };
}

async function uploadFileToGemini(args: {
  apiKey: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
}) {
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${args.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(args.blob.size),
        'X-Goog-Upload-Header-Content-Type': args.mimeType,
      },
      body: JSON.stringify({
        file: {
          display_name: args.fileName,
        },
      }),
    }
  );

  if (!startResponse.ok) {
    throw new Error(
      `Gemini upload initialization failed: ${await startResponse.text()}`
    );
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini did not return a resumable upload URL.');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(args.blob.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: args.blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Gemini upload failed: ${await uploadResponse.text()}`);
  }

  const payload = (await uploadResponse.json()) as GeminiFilePayload;
  return extractGeminiFile(payload);
}

async function waitForFileToBecomeActive(args: {
  apiKey: string;
  fileName: string;
}) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${args.fileName}?key=${args.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Gemini file polling failed: ${await response.text()}`);
    }

    const payload = (await response.json()) as GeminiFilePayload;
    const file = extractGeminiFile(payload);

    const state =
      typeof file.state === 'string'
        ? file.state
        : (file.state?.name ?? 'ACTIVE');

    if (state === 'ACTIVE') {
      return file;
    }

    if (state === 'FAILED') {
      throw new Error('Gemini marked the uploaded file as FAILED.');
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error('Gemini file did not become ACTIVE within five minutes.');
}

async function requestQaResult(args: {
  apiKey: string;
  file: GeminiFile;
  fileName: string;
  mimeType: string;
}) {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${args.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildQaSystemPrompt(args.fileName) },
              {
                fileData: {
                  mimeType: args.mimeType,
                  fileUri: args.file.uri,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini scoring failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini did not return a JSON scoring payload.');
  }

  return parseQaResult(JSON.parse(normalizeJsonResponse(text)));
}

export const processVideo = internalAction({
  args: {
    videoId: v.id('videos'),
  },
  handler: async (ctx, args) => {
    const video = await ctx.runQuery(internal.videos.getVideoForProcessing, {
      videoId: args.videoId,
    });

    if (!video) {
      throw new Error('The queued QA video no longer exists.');
    }

    if (video.status === 'processing' || video.status === 'completed') {
      return null;
    }

    await ctx.runMutation(internal.videos.markProcessing, {
      videoId: video._id,
    });

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'GEMINI_API_KEY must be configured before QA video processing can run.'
        );
      }

      const sourceBlob = await ctx.storage.get(video.sourceStorageId);
      if (!sourceBlob) {
        throw new Error('The uploaded video could not be loaded from storage.');
      }

      const uploadedFile = await uploadFileToGemini({
        apiKey,
        blob: sourceBlob,
        fileName: video.fileName,
        mimeType: video.mimeType,
      });

      const activeFile = await waitForFileToBecomeActive({
        apiKey,
        fileName: uploadedFile.name,
      });

      const result = await requestQaResult({
        apiKey,
        file: activeFile,
        fileName: video.fileName,
        mimeType: video.mimeType,
      });

      await ctx.runMutation(internal.videos.markCompleted, {
        videoId: video._id,
        googleFileUri: activeFile.uri,
        result,
      });
    } catch (error) {
      await ctx.runMutation(internal.videos.markFailed, {
        videoId: video._id,
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }

    return null;
  },
});
