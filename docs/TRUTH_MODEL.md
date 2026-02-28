# RosterSyncOS Truth Model

## What Is Truth?

In RosterSyncOS, **truth is what the database says**. There is no frontend truth, no in-memory truth, no "it depends." Given a `(studioId, weekStart)` pair, the system deterministically computes the effective schedule through a strict layered model.

Every derived view — planner UI, sync payload, audit trail — is a **projection** of these layers, never a source.

---

## Truth Layers

### 1. Base State

The schedule as originally defined by recurring templates before any exception handling.

- **Source:** `RecurringSlotTemplate` + `SessionOccurrence` (base fields)
- **Fields:** `baseClassTypeId`, `baseInstructorId`, `startDateTimeUTC`, `endDateTimeUTC`
- **Immutability:** Base fields on a SessionOccurrence are set at generation time and never mutated. Template edits affect future weeks only.

### 2. Override State

Explicit modifications that supersede base assignments.

- **Source:** `SessionOccurrence.override*` fields + `AuditLog`
- **Fields:** `overrideInstructorId`, `overrideClassTypeId`, `overrideReason`
- **Requirements:**
  - Every override must have a `reason`
  - Every override emits an `AuditLog` entry with `actor`, `action`, `beforeJson`, `afterJson`
  - Overrides are append-only in audit terms (the session row is mutable, but the audit trail is immutable)

### 3. Compatibility State

A computed layer describing feasible substitutes and class type conversions.

- **Source:** `InstructorSkill` + `CompatibilityRule`
- **Computation:** When a cover is accepted, the system checks if the substitute can teach the current class type. If not, it walks `CompatibilityRule` entries ordered by priority to find a teachable alternative.
- **Determinism:** Same inputs (skills + rules + priority order) always produce the same resolved class type.

### 4. Effective State

The resolved assignment after applying all layers with strict precedence.

- **Computation:** Pure function `deriveEffectiveSchedule(studioId, weekId)` → `{ effectiveSessions[], weekHash }`
- **Precedence (highest to lowest):**
  1. Hard constraints (studio closed, instructor unavailable, legal rules)
  2. Admin overrides (`overrideInstructorId` / `overrideClassTypeId` set by ADMIN/SCHEDULER)
  3. Accepted cover assignment (cover acceptance sets override fields)
  4. Base schedule (`baseInstructorId` / `baseClassTypeId`)
- **Traceability:** Each session in the effective schedule includes a `reason` field explaining why the current assignment holds.

### 5. Published State

A frozen snapshot of effective state at publish time.

- **Source:** `Week` (status=PUBLISHED) + `PublishSnapshot`
- **Fields:** `weekHash` (SHA-256 of effective content), `publishedAt`, `publishedBy`, `publishVersion`
- **Immutability:** Once published, the snapshot is frozen. Changes after publish create a new draft cycle.
- **Idempotency:** Publishing the same effective state (same weekHash) returns the existing publish — no duplicate version created.

### 6. Synced State

External system sync results for a published version.

- **Source:** `WixSyncJob`
- **Fields:** `idempotencyKey`, `status`, `attempts`, `lastError`, `payloadHash`
- **Constraint:** Sync jobs reference published state via the payload hash derived from effective assignments. Sync never reads "current" state directly.
- **Idempotency:** `idempotencyKey = UPSERT:{sessionId}:{payloadHash}` — replaying the same publish never duplicates external mutations.

---

## Truth Resolution Algorithm

Given a session, the effective assignment is resolved as:

```
effectiveInstructorId = overrideInstructorId ?? baseInstructorId
effectiveClassTypeId  = overrideClassTypeId  ?? baseClassTypeId
```

The `reason` trace follows:

1. If `overrideInstructorId` is set AND a CoverOpportunity with status=ASSIGNED exists → reason = "Cover Accepted"
2. If `overrideInstructorId` is set WITHOUT cover → reason = "Admin Override"
3. If neither override is set → reason = "Default Schedule"

### Conflict Rules

| Conflict Type | Severity | Blocks Publish? |
|--------------|----------|-----------------|
| UNASSIGNED (no instructor) | CRITICAL | Yes |
| SKILL_MISMATCH | CRITICAL | Yes |
| UNAVAILABLE | CRITICAL | Yes |
| DOUBLE_BOOKED | CRITICAL | Yes |
| MAX_LOAD_EXCEEDED (>15/week) | WARNING | No |

- **Publish** is forbidden if ANY `CRITICAL` conflicts exist.
- **Publish** is allowed with `WARNING` conflicts (they are surfaced in UI).
- **Sync** is only triggered after successful publish.

---

## Failure Modes and Resolution

| Failure | Resolution |
|---------|------------|
| Instructor sick after publish | New override → week returns to DRAFT → re-publish required |
| Sync fails mid-run | Jobs remain in FAILED status → retry via Sync Console → idempotency key prevents duplicate external mutations |
| Double cover acceptance | Transactional locking — first ACCEPT wins, second gets 400 error |
| Template changed after week generated | Base fields on existing sessions are unchanged — only future generations affected |
| Algorithm version change | weekHash will differ → new publish required → old snapshot preserved |

---

## Event Causality

Every truth-changing action follows this chain:

```
User Action → Precondition Check → State Mutation → Audit Event → UI Refresh
```

No state mutation occurs without an audit event. No audit event occurs without a valid precondition check.
