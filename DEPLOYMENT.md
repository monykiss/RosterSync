# RosterSyncOS Deployment Guide

## Recommended Demo Topology

For the KLYTICS client demo, the lowest-risk deploy shape is:

- `rostersync-web`: Next.js app
- `rostersync-api`: NestJS API
- `rostersync-db`: Postgres 16
- `rostersync-redis`: Redis/Key Value for BullMQ

This repo now includes a Render Blueprint at [render.yaml](/Users/money/Desktop/RosterSync/render.yaml) for that topology.

## Demo Mode Recommendation

Use these settings for the client demo environment:

- `AUTH_MODE=DEMO`
- `DEMO_USER_EMAIL=admin@rostersyncos.io`
- `WIX_MODE=STUB`
- `WIX_STUB_FAIL_RATE=0`

That keeps auth friction low, preserves audit integrity with seeded demo users, and avoids unstable external sync behavior during the presentation.

## Render Deploy Steps

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Create a new Render Blueprint from the repo root.
3. Apply the Blueprint from [render.yaml](/Users/money/Desktop/RosterSync/render.yaml).
4. After Render creates both web services, set:
   - `rostersync-api.CORS_ORIGINS` = your public web URL
   - `rostersync-web.NEXT_PUBLIC_API_URL` = your public API URL
   - `rostersync-web.NEXTAUTH_URL` = your public web URL
5. Open a shell on the API service and run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter api exec prisma migrate deploy
pnpm --filter api db:seed
```

Before each client meeting, reset the staged demo data:

```bash
pnpm --filter api demo:reset
```

## Local Validation Before Deploy

```bash
pnpm install
pnpm --filter api test -- --runInBand
pnpm build
```

Hosted smoke checks:

```bash
pnpm --filter api smoke-test -- https://your-api-url
pnpm --filter web demo:smoke -- https://your-web-url
```

## Demo Credentials

The seed creates these users:

- Admin: `admin@rostersyncos.io` / `Admin2026!`
- Scheduler: `scheduler@rostersyncos.io` / `Demo2026!`
- Instructor: `carole@rostersyncos.io` / `Demo2026!`

In `AUTH_MODE=DEMO`, the app bypasses login enforcement and acts as the seeded admin user.

## Demo Smoke Path

Run this exact path before the client session:

1. Open the dashboard and confirm the seeded studio and week appear.
2. Open the planner and verify one session already demonstrates the Carole compatibility override.
3. Mark an instructor unavailable or mark a session `Needs Cover`.
4. Confirm cover offers appear in the Covers page and Instructor dashboard.
5. Accept a cover and confirm the session updates immediately.
6. Publish the week and verify the Sync Dashboard shows deterministic queued/succeeded jobs.
7. Open Notifications and confirm cover, publish, and sync events are visible in-app.

## Notes

- `WIX_MODE=LIVE` is still not implemented. Use `STUB` for all demos.
- Dockerfiles are fixed for container builds, but the Render Blueprint is the preferred path for a fast staging/demo rollout.
- The API health endpoint is available at `/health`.
- Use [docs/demo-runbook.md](/Users/money/Desktop/RosterSync/docs/demo-runbook.md) as the client-facing walkthrough script.
