# Hosted Demo Runbook

## Goal

Show a live hosted demo that proves the client workflow end to end:

- studios and timezones
- class types and compatibility rules
- recurring slot templates
- instructor roster and skills
- instructor unavailability and cover operations
- compatibility fallback from `Booty & Abs` to `Full Body`
- planner review and publish
- sync dashboard and retry
- in-app notifications

## Reset Before Demo

Run these commands on the API service before each meeting:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter api exec prisma migrate deploy
pnpm --filter api demo:reset
```

Optional verification:

```bash
pnpm --filter api smoke-test -- https://your-api-url
pnpm --filter web demo:smoke -- https://your-web-url
```

## Walkthrough Order

### 1. Studios and Timezones

- Open `Studios`.
- Show `Studio A - Downtown` as the active demo workspace.
- Note the timezone handling for Puerto Rico.
- Mention that `Studio B - Uptown` exists to demonstrate multi-tenant separation.

### 2. Class Types and Compatibility Rules

- Open `Class Types`.
- Point out `Booty & Abs` and `Full Body`.
- Open `Compatibility`.
- Show the rule mapping `Booty & Abs -> Full Body`.
- Explain that the rule is session-specific, not a template rewrite.

### 3. Recurring Slot Templates

- Open `Slot Templates`.
- Show the weekly recurring slots that drive week generation.
- Highlight Tuesday `8:00 Booty & Abs` and Friday `8:00 Full Body`.

### 4. Instructor Roster and Skill Matrix

- Open `Instructors`.
- Show Instructor A, Carole, Dave, and Emily.
- Open Carole's skills and note that she cannot teach `Booty & Abs` directly but can teach `Full Body`.

### 5. Instructor Unavailability and Cover Opportunity Creation

- Open `My Schedule` as Carole if you want to show the instructor role live.
- Show the pending cover opportunities and recent notifications.
- Mention that unavailability submission generates cover workflow state and in-app alerts.

### 6. Cover Acceptance and Compatibility Fallback

- Open the draft workflow week in the planner.
- Click the Tuesday session.
- Show that Instructor A was replaced by Carole.
- Show that the class changed from `Booty & Abs` to `Full Body` only for that session.
- Open `Covers` and show the remaining live cover inventory.

### 7. Planner Review and Publish

- From the dashboard, open the draft week.
- Show the planner state, readiness bar, and session statuses.
- Open the publish modal and explain the pre-publish checks.
- Publish the draft week to create an immutable snapshot and enqueue sync jobs.

### 8. Sync Dashboard and Retry

- Open `Sync Status`.
- Call out that the environment is running in `STUB MODE`.
- Show the published week's mixed sync outcomes:
  - at least one success
  - at least one failure
  - retry support from the dashboard
- Retry a failed job and explain that this demonstrates the sync control plane without claiming live Wix writes.

### 9. Notifications Proof Points

- Open `Notifications`.
- Show:
  - `COVER_OPPORTUNITY`
  - `COVER_ASSIGNED`
  - `SCHEDULE_PUBLISHED`
  - `SYNC_FAILED`
- Note that this milestone uses in-app notifications only.

## Claims We Can Make Honestly

### Yes

- End-to-end scheduling workflow
- Substitution handling
- Class compatibility remap at the single-session level
- Publish controls and immutable snapshots
- Sync architecture, observability, and retry
- Hosted demo deployment on Render

### Not Yet

- Live Wix API writes in `WIX_MODE=LIVE`
- Outbound email or SMS notifications

## Demo Credentials

- Admin: `admin@rostersyncos.io` / `Admin2026!`
- Scheduler: `scheduler@rostersyncos.io` / `Demo2026!`
- Instructor: `carole@rostersyncos.io` / `Demo2026!`
