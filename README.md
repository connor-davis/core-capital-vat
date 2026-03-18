# Core Capital QA Automation

Single-tenant QA reviewer workspace built with React, TanStack Router, Convex, and WorkOS AuthKit.

## What is implemented

- Reviewer dashboard with authenticated upload flow
- Convex-backed `videos` domain model and status tracking
- Gemini processing action that uploads recordings to the Google File API and stores rubric-scored JSON results
- Dynamic report route at `/report/$videoId`
- PDF report export and Resend-backed report email action
- Convex retention jobs for source-video cleanup and report expiry

## Required environment variables

Create local environment values for the frontend and Convex runtime:

```bash
VITE_CONVEX_URL=...
VITE_CONVEX_SITE_URL=...
VITE_WORKOS_CLIENT_ID=...
VITE_WORKOS_REDIRECT_URI=...
WORKOS_CLIENT_ID=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-pro
RESEND_API_KEY=...
RESEND_FROM_EMAIL=qa-reports@example.com
```

`GEMINI_MODEL` is optional, but the current implementation defaults to `gemini-2.5-pro`.

## Running locally

```bash
bun install
bunx convex dev
bun run dev
```

## Validation

```bash
bunx convex codegen
bun run typecheck
bun run build
bun run lint
```

## Notes

- Uploads are stored in Convex storage first, then processed asynchronously by Convex actions.
- Source videos are scheduled for deletion after processing.
- Report records are purged by Convex crons after the retention window expires.
