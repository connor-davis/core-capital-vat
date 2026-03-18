'use node';

import { v } from 'convex/values';

import {
  DEFAULT_GEMINI_MODEL,
  buildQaSystemPrompt,
  qaResultSchema,
} from '../shared/qa';
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown processing error occurred.';
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

  return qaResultSchema.parse(JSON.parse(normalizeJsonResponse(text)));
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
