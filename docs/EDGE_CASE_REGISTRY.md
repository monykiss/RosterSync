# RosterSyncOS Edge Case Registry

25 edge cases with expected truth, required audit events, and UI signals.

---

## EC-01: Instructor sick after publish

**Setup:** Week published with Instructor A on Session X. Instructor A then marks sick.
**Expected Truth:** Week must revert to DRAFT. Session X gets UNAVAILABLE conflict. Publish button disabled until resolved.
**Audit Events:** `UNAVAILABILITY_CREATED`, `WEEK_REDRAFTED` (if system auto-redrafts)
**UI Signal:** Conflict badge on Session X, "Needs attention" week status.

## EC-02: Two admins accept two different covers simultaneously

**Setup:** Session X has CoverOpportunity with offers to Carole and Dave. Admin 1 accepts Carole's offer. Admin 2 simultaneously accepts Dave's offer.
**Expected Truth:** First transaction wins. Second receives 400 error ("Offer already responded to" or "Opportunity already assigned").
**Audit Events:** One `COVER_ACCEPTED` event for the winner.
**UI Signal:** Session shows the first accepted instructor.

## EC-03: Publish clicked twice in rapid succession

**Setup:** Admin clicks Publish. Network is slow. Admin clicks again.
**Expected Truth:** First publish succeeds and stores weekHash. Second publish detects same weekHash → returns existing publish (idempotent).
**Audit Events:** Only one `PUBLISH_WEEK` event.
**UI Signal:** "Already published with latest state" message on second click.

## EC-04: Sync fails mid-run after partial external updates

**Setup:** Week published with 10 sessions. Sync succeeds for sessions 1-5, fails on session 6 (Wix API error).
**Expected Truth:** Sessions 1-5 have SUCCEEDED sync jobs. Session 6+ have FAILED jobs. No session state is mutated by sync.
**Audit Events:** Individual sync job status changes logged.
**UI Signal:** Sync Console shows 5 green, 5 red. Retry button available per failed job.

## EC-05: Override added while sync is in progress

**Setup:** Week published. Sync running. Admin overrides Session X's instructor.
**Expected Truth:** Override succeeds, session updated. Week should revert to DRAFT (or at minimum, the new override invalidates the current publish). Existing sync jobs complete but the new state requires re-publish.
**Audit Events:** `SESSION_OVERRIDE`, possibly `WEEK_REDRAFTED`.
**UI Signal:** Week status shows DRAFT, publish button re-enabled.

## EC-06: Cover accepted for a session that was deleted/cancelled

**Setup:** CoverOpportunity created for Session X. Before response, admin cancels Session X.
**Expected Truth:** Cover acceptance should fail with "Session is cancelled" error. No override applied.
**Audit Events:** `SESSION_CANCELLED`.
**UI Signal:** Opportunity list shows "Session no longer available."

## EC-07: Timezone boundary shifts session across midnight

**Setup:** Studio timezone is America/Puerto_Rico (UTC-4). Slot template at 22:00 local, duration 120 mins. Session spans midnight into next day.
**Expected Truth:** `startDateTimeUTC` = 02:00Z, `endDateTimeUTC` = 04:00Z. Session correctly associated with the starting day's week.
**Audit Events:** None specific (generation handles it).
**UI Signal:** Session displays correctly in local time spanning two calendar days.

## EC-08: Algorithm version changes between weeks

**Setup:** Week 1 published with ranking algorithm v1. Week 2 uses v2 (different weights).
**Expected Truth:** Week 1's snapshot is frozen with v1 results. Week 2 uses v2. weekHash will differ. No retroactive changes.
**Audit Events:** None specific (versioning is implicit in hash).
**UI Signal:** None visible.

## EC-09: Instructor eligibility changes after offers are generated

**Setup:** CoverOffers generated for Session X. Carole is ranked #1. Admin then removes Carole's skill for that class type.
**Expected Truth:** If Carole accepts after skill removal, the compatibility resolver runs and either finds a compatible class type or keeps original with warning. The acceptance itself is not blocked.
**Audit Events:** `COVER_ACCEPTED` with compatibility resolution trace.
**UI Signal:** If no compatible type found, session flagged for scheduler attention.

## EC-10: Conflict resolved by override but leaves compatibility mismatch

**Setup:** Session X has UNAVAILABLE conflict. Admin manually overrides instructor to Dave. Dave cannot teach the class type, and no compatibility rule exists.
**Expected Truth:** SKILL_MISMATCH conflict raised. Publish blocked until admin also overrides class type or adds a skill.
**Audit Events:** `SESSION_OVERRIDE`.
**UI Signal:** SKILL_MISMATCH badge on Session X.

## EC-11: Week regeneration after overrides exist

**Setup:** Week generated, admin overrides Session X. Admin calls generateWeek again.
**Expected Truth:** Upsert on `(slotTemplateId, startDateTimeUTC)` — existing sessions are NOT overwritten. Override fields preserved. New templates generate new sessions.
**Audit Events:** `WEEK_GENERATED` (re-generation).
**UI Signal:** Existing sessions unchanged, new slots appear if templates added.

## EC-12: Template deactivated after week generation

**Setup:** Slot template "Tue 8:00 Booty & Abs" is deactivated. Week already generated with sessions from it.
**Expected Truth:** Existing sessions remain. Future week generations will not include this template. No retroactive deletion.
**Audit Events:** None on existing sessions.
**UI Signal:** Template appears inactive in settings but sessions persist.

## EC-13: Instructor marked unavailable for partial overlap

**Setup:** Session 08:00-08:50. Instructor marks unavailable 08:30-10:00.
**Expected Truth:** UNAVAILABLE conflict detected (overlap check catches partial intersection).
**Audit Events:** `UNAVAILABILITY_CREATED`.
**UI Signal:** Conflict badge on session.

## EC-14: All cover offers declined

**Setup:** CoverOpportunity with 5 offers. All 5 decline.
**Expected Truth:** Opportunity status reverts to OPEN. Session remains NEEDS_COVER. System can regenerate offers (with different candidates or same if no new instructors available).
**Audit Events:** 5x `COVER_DECLINED`.
**UI Signal:** "All candidates declined" indicator.

## EC-15: Instructor at max weekly slots receives cover offer

**Setup:** Instructor has maxWeeklySlots=6 and already has 6 sessions. Receives cover offer.
**Expected Truth:** Offer is still created but with heavy ranking penalty (-50 points). If accepted, MAX_LOAD_EXCEEDED warning raised but does not block.
**Audit Events:** `COVER_ACCEPTED` if accepted.
**UI Signal:** Warning badge, not blocking.

## EC-16: Same session published, synced, then overridden and re-published

**Setup:** Session X published (hash A), synced to Wix. Admin overrides instructor. Re-publishes (hash B).
**Expected Truth:** New weekHash (B) created. New sync jobs enqueued with new idempotency key (different hash). Wix receives the updated payload.
**Audit Events:** `SESSION_OVERRIDE`, `PUBLISH_WEEK` (second), sync job events.
**UI Signal:** Sync Console shows new pending jobs.

## EC-17: Studio with zero templates

**Setup:** Admin calls generateWeek for a studio with no active slot templates.
**Expected Truth:** Week record created with zero sessions. No error. Planner shows empty week.
**Audit Events:** `WEEK_GENERATED` (0 sessions).
**UI Signal:** Empty planner, "No sessions scheduled" message.

## EC-18: Cover offer to instructor who is themselves unavailable

**Setup:** CoverOpportunityEngine runs. Instructor B is in candidate list but has overlapping unavailability.
**Expected Truth:** Instructor B is filtered out by the availability check in the engine. No offer created.
**Audit Events:** None (filtered at offer generation, not at response time).
**UI Signal:** Instructor B does not appear in offer list.

## EC-19: Concurrent week generation calls

**Setup:** Two API calls to generateWeek with same studioId + weekStart arrive simultaneously.
**Expected Truth:** First creates the Week record. Second finds it existing (findFirst). Both proceed to upsert sessions. Upsert is idempotent → no duplicates.
**Audit Events:** One or two `WEEK_GENERATED` events (both are valid).
**UI Signal:** Planner shows correct session count.

## EC-20: Wix integration mode is STUB

**Setup:** Studio's WixIntegration.mode = STUB.
**Expected Truth:** Sync jobs are created normally. The sync worker (when implemented) should detect STUB mode and mark jobs as SUCCEEDED without making external calls.
**Audit Events:** Sync job status changes logged.
**UI Signal:** Sync Console shows jobs completing (stub mode indicated).

## EC-21: Session with both override instructor and override class type

**Setup:** Admin manually sets both overrideInstructorId and overrideClassTypeId.
**Expected Truth:** Both overrides honored. Effective state uses both override values. weekHash reflects overrides.
**Audit Events:** `SESSION_OVERRIDE` with beforeJson/afterJson showing both changes.
**UI Signal:** Session card shows override indicator, drawer shows both override fields.

## EC-22: Publishing week with only WARNING conflicts

**Setup:** Week has one MAX_LOAD_EXCEEDED warning but no CRITICAL conflicts.
**Expected Truth:** Publish succeeds. Warnings are surfaced but do not block.
**Audit Events:** `PUBLISH_WEEK`.
**UI Signal:** Publish modal shows "1 warning" but button is enabled.

## EC-23: Deleting a studio with existing weeks and sessions

**Setup:** Admin attempts to delete Studio A which has weeks, sessions, sync jobs.
**Expected Truth:** Cascade delete should handle all child records, OR the operation should be blocked if referential integrity prevents it.
**Audit Events:** `STUDIO_DELETED` if allowed.
**UI Signal:** Confirmation dialog required.

## EC-24: Cover accepted, then original instructor becomes available again

**Setup:** Instructor A was sick, Carole covered. Instructor A recovers and marks available.
**Expected Truth:** Cover assignment stands. Admin can manually revert override if desired. No automatic revert.
**Audit Events:** `UNAVAILABILITY_DELETED` or updated.
**UI Signal:** No automatic change to session. Admin can see instructor A is available again.

## EC-25: Bulk sync enqueue with mixed studio sessions

**Setup:** API call to bulkEnqueueSessionSync with sessionIds from different studios.
**Expected Truth:** Rejected with 400 error. All sessions must belong to the specified studioId.
**Audit Events:** None (request rejected).
**UI Signal:** Error toast.
