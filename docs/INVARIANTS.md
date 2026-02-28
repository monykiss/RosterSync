# RosterSyncOS Invariants

40 invariants grouped by domain. Each must be tested.

---

## Sessions (INV-S)

**INV-S01**: Every SessionOccurrence has a non-null `baseClassTypeId`.
**INV-S02**: Every SessionOccurrence has a valid `slotTemplateId` referencing an existing template.
**INV-S03**: `startDateTimeUTC < endDateTimeUTC` for every session.
**INV-S04**: The unique constraint `(slotTemplateId, startDateTimeUTC)` prevents duplicate sessions on regeneration.
**INV-S05**: Base fields (`baseClassTypeId`, `baseInstructorId`) are set at generation time and never mutated by cover/override flows (overrides use `override*` fields).
**INV-S06**: `overrideReason` is non-null whenever `overrideInstructorId` or `overrideClassTypeId` is set.
**INV-S07**: Effective instructor = `overrideInstructorId ?? baseInstructorId`. Effective class type = `overrideClassTypeId ?? baseClassTypeId`. No other derivation path exists.

---

## Covers (INV-C)

**INV-C01**: At most one `CoverOpportunity` exists per session (enforced by `@@unique([sessionId])`).
**INV-C02**: Accepting a cover sets `overrideInstructorId` on the session and triggers compatibility resolution.
**INV-C03**: A cover acceptance for a session that belongs to a different studio than the instructor is rejected.
**INV-C04**: Only one offer per opportunity can be ACCEPTED. Once one is ACCEPTED, all others for that opportunity are implicitly closed.
**INV-C05**: An offer can only be responded to once (PENDING → ACCEPT or PENDING → DECLINE).
**INV-C06**: Cover acceptance triggers compatibility resolution. If the substitute cannot teach the original class type, the system applies `CompatibilityRule` in priority order.
**INV-C07**: If no compatible class type is found, the original class type is kept and the session is flagged for scheduler attention.
**INV-C08**: Compatibility resolution only affects the specific SessionOccurrence, never the RecurringSlotTemplate.

---

## Conflicts (INV-F)

**INV-F01**: ConflictEngine evaluates ALL sessions in a week, not a subset.
**INV-F02**: UNASSIGNED conflict: session with no effective instructor is always CRITICAL.
**INV-F03**: SKILL_MISMATCH conflict: effective instructor lacks `canTeach=true` for effective class type → CRITICAL.
**INV-F04**: UNAVAILABLE conflict: effective instructor has overlapping `Unavailability` record → CRITICAL.
**INV-F05**: DOUBLE_BOOKED conflict: effective instructor assigned to two overlapping sessions → CRITICAL.
**INV-F06**: MAX_LOAD_EXCEEDED: instructor with >15 sessions/week → WARNING (does not block publish).
**INV-F07**: Conflict evaluation is deterministic: same DB state always produces same conflict list.

---

## Publish (INV-P)

**INV-P01**: Publish is forbidden if any CRITICAL conflicts exist for the week.
**INV-P02**: Publish computes `weekHash` via SHA-256 of the serialized effective schedule (ordered, normalized).
**INV-P03**: Publish is idempotent: if `weekHash` matches the already-published hash, no new version is created.
**INV-P04**: Publish sets `status=PUBLISHED`, `publishedAt=now()`, and stores `weekHash`.
**INV-P05**: Publish emits a `PUBLISH_WEEK` audit event with `actorUserId` and `weekId`.
**INV-P06**: Publish triggers bulk sync job enqueue for all sessions in the week.
**INV-P07**: A published week's effective state is frozen at publish time via the stored weekHash.

---

## Sync (INV-Y)

**INV-Y01**: Sync jobs reference the published payload hash, never "current" live state.
**INV-Y02**: `idempotencyKey` = `UPSERT:{sessionId}:{payloadHash}` — prevents duplicate external mutations.
**INV-Y03**: Upsert on `idempotencyKey` means replaying the same publish never creates duplicate sync jobs.
**INV-Y04**: Sync retry resets `status=PENDING` and `attempts=0` — the payload is re-sent with the same idempotency key.
**INV-Y05**: Failed sync jobs remain in `FAILED` status with `lastError` populated until manually retried.
**INV-Y06**: Sync never mutates session or week state — it only reads the payload and writes to the external system.

---

## Audit (INV-A)

**INV-A01**: Every override emits an audit event with `action`, `beforeJson`, `afterJson`, `reason`.
**INV-A02**: Every cover acceptance emits an audit event.
**INV-A03**: Every publish emits an audit event.
**INV-A04**: Every sync retry emits an audit event.
**INV-A05**: AuditLog records are append-only. No update or delete on audit records.
**INV-A06**: Every audit event includes `studioId` and `actorUserId`.

---

## Multi-Tenant Isolation (INV-T)

**INV-T01**: Every database query that returns schedule data includes a `studioId` filter.
**INV-T02**: No API endpoint can return data from a studio the caller does not belong to.
**INV-T03**: Composite indexes exist for `(studioId, weekStartDate)`, `(studioId, weekId)`, `(studioId, status)` to enforce efficient scoped queries.
**INV-T04**: Cross-studio cover offers are impossible — the CoverOpportunityEngine only queries instructors within the session's studioId.
**INV-T05**: Sync jobs are scoped by studioId — bulk operations validate all sessions belong to the same studio.
