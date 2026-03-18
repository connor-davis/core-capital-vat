import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { action } from './_generated/server';

declare const process: {
  env: Record<string, string | undefined>;
};

export const sendReportEmail = action({
  args: {
    recipientEmail: v.string(),
    reportUrl: v.string(),
    videoId: v.id('videos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError('You must be signed in to send QA reports.');
    }

    const video = await ctx.runQuery(internal.videos.getVideoForProcessing, {
      videoId: args.videoId,
    });

    if (!video || video.userId !== identity.tokenIdentifier) {
      throw new ConvexError('The requested QA report could not be found.');
    }

    if (!video.result) {
      throw new ConvexError(
        'Completed scoring data is required before emailing a report.'
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      throw new Error(
        'RESEND_API_KEY and RESEND_FROM_EMAIL must be configured before sending reports.'
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [args.recipientEmail],
        subject: `QA report for ${video.fileName}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5;">
            <h2>Lesson QA report</h2>
            <p><strong>Recording:</strong> ${video.fileName}</p>
            <p><strong>Overall score:</strong> ${Math.round(video.result.overallScore)}%</p>
            <p><strong>Confidence:</strong> ${Math.round(video.result.confidence * 100)}%</p>
            <p>Open the full report here:</p>
            <p><a href="${args.reportUrl}">${args.reportUrl}</a></p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend email request failed: ${await response.text()}`);
    }

    return null;
  },
});
