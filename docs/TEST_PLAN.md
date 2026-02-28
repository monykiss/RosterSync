# RosterSyncOS Test Plan

## Test Matrix: Invariants → Tests

| Invariant | Test File | Test Name |
|-----------|-----------|-----------|
| INV-S04 | session-generation.spec.ts | idempotent regeneration produces no duplicates |
| INV-S07 | truth-derivation.spec.ts | effective fields follow override ?? base precedence |
| INV-C01 | cover-engine.spec.ts | only one opportunity per session |
| INV-C06 | compatibility.spec.ts | compatibility resolver walks rules in priority order |
| INV-C08 | compatibility.spec.ts | compatibility override does not mutate template |
| INV-F01 | conflict-engine.spec.ts | evaluates all sessions in week |
| INV-F02 | conflict-engine.spec.ts | unassigned session is CRITICAL |
| INV-F03 | conflict-engine.spec.ts | skill mismatch is CRITICAL |
| INV-F04 | conflict-engine.spec.ts | unavailable instructor is CRITICAL |
| INV-F05 | conflict-engine.spec.ts | double booking is CRITICAL |
| INV-F06 | conflict-engine.spec.ts | max load exceeded is WARNING |
| INV-F07 | conflict-engine.spec.ts | same input produces same conflicts |
| INV-P01 | weeks-publish.spec.ts | publish blocked by CRITICAL conflicts |
| INV-P02 | truth-derivation.spec.ts | weekHash is SHA-256 of ordered effective sessions |
| INV-P03 | weeks-publish.spec.ts | double publish returns existing version |
| INV-P05 | weeks-publish.spec.ts | publish emits audit event |
| INV-Y01 | sync-idempotency.spec.ts | sync uses payload hash not live state |
| INV-Y02 | sync-idempotency.spec.ts | same payload produces same idempotency key |
| INV-Y03 | sync-idempotency.spec.ts | duplicate enqueue is no-op via upsert |
| INV-T01 | tenant-isolation.spec.ts | queries always include studioId |
| INV-T05 | sync-idempotency.spec.ts | bulk sync validates all sessions same studio |

---

## Test Categories

### 1. Unit Tests — Derivation Functions

**File:** `truth-derivation.spec.ts`

- Same DB snapshot → same effective schedule → same weekHash (determinism)
- Override fields take precedence over base fields
- Reason trace correctly identifies: "Default Schedule", "Admin Override", "Cover Accepted"
- Empty week produces empty effective schedule with consistent hash

### 2. Unit Tests — Conflict Engine

**File:** `conflict-engine.spec.ts`

- Session with no instructor → UNASSIGNED CRITICAL
- Session with instructor lacking skill → SKILL_MISMATCH CRITICAL
- Session during instructor unavailability → UNAVAILABLE CRITICAL
- Two overlapping sessions for same instructor → DOUBLE_BOOKED CRITICAL
- Instructor with 16+ sessions → MAX_LOAD_EXCEEDED WARNING
- No conflicts → empty array returned
- Determinism: same input, same output (run twice, compare)

### 3. Unit Tests — Compatibility Resolver

**File:** `compatibility.spec.ts`

- Instructor can teach original → returns original class type
- Instructor cannot teach original, compat rule exists → returns compatible type
- Multiple compat rules → lowest priority number wins
- No compat rules → returns original with "requires attention" reason
- Disabled compat rule is skipped

### 4. Unit Tests — Cover Ranking Engine

**File:** `cover-engine.spec.ts`

- Direct skill match gets highest score (100)
- Compatibility match gets lower score (80 - priority*10)
- Load penalty applied correctly (-2 per session)
- Max weekly slots exceeded gets -50 penalty
- Unavailable instructors filtered out
- Double-booked instructors filtered out
- Ranking is deterministic for identical inputs
- Top 5 candidates selected

### 5. Integration Tests — Session Generation

**File:** `session-generation.spec.ts`

- Generate week creates sessions from all active templates
- Regeneration does not duplicate (upsert idempotency)
- Published week cannot be regenerated (ConflictException)
- Template with no default instructor creates session with null baseInstructorId

### 6. Integration Tests — Publish Flow

**File:** `weeks-publish.spec.ts`

- Publish succeeds when no CRITICAL conflicts
- Publish fails (400) when CRITICAL conflicts exist
- Publish sets status=PUBLISHED, publishedAt, weekHash
- Publish creates audit log entry
- Publish enqueues sync jobs for all sessions
- Double publish (same hash) returns existing without new version
- Publish with WARNING conflicts succeeds

### 7. Integration Tests — Sync Idempotency

**File:** `sync-idempotency.spec.ts`

- enqueueSessionSync creates job with deterministic idempotencyKey
- Duplicate enqueue (same session + same payload) is no-op
- Different payload produces different idempotency key
- bulkEnqueueSessionSync rejects mixed-studio sessions
- retryJob resets status and attempts
- Payload hash is stable for same effective state

### 8. Concurrency Tests

- Double accept cover: only one succeeds (test with sequential calls simulating race)
- Double publish: second returns existing

---

## Commands

```bash
# Run all unit + integration tests
cd apps/api && pnpm test

# Run specific test file
cd apps/api && pnpm test -- --testPathPattern=conflict-engine

# Run with coverage
cd apps/api && pnpm test:cov
```

---

## Acceptance Criteria

All tests must pass before declaring any milestone complete:

- [ ] Determinism tests: same input → same output (hash, conflicts, ranking)
- [ ] Concurrency tests: double accept, double publish handled correctly
- [ ] Idempotency tests: regeneration, publish, sync enqueue
- [ ] Transition tests: DRAFT→PUBLISHED blocked by conflicts
- [ ] Audit tests: every state change produces audit entry
- [ ] Tenant isolation: no cross-studio data possible
