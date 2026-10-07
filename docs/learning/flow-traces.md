# Flow Traces

## Flow: Create lead from dashboard
1. `src/components/dashboard/create-lead-form.tsx` — form submit calls `createLead.mutateAsync()`
2. `src/hooks/use-dashboard.ts` — `useCreateLead()` fires `POST /api/leads`
3. `src/app/api/leads/route.ts` — `POST()`
4. `src/lib/middleware/withAuth.ts` — `withAuth()` checks the cookie-backed session
5. `src/lib/validation/leadSchemas.ts` — `createLeadSchema.parse()`
6. `src/services/leadService.ts` — `createLeadRecord()` enforces owner assignment rules and starts a transaction
7. `src/repositories/userRepository.ts` — `findUserById()` validates the owner
8. `src/repositories/leadRepository.ts` — `createLead()` inserts the lead
9. `src/repositories/activityRepository.ts` — `createActivityLog()` writes `LEAD_CREATED`
10. Returns created lead card JSON

**Correction (steps 6-7):** `findUserById()` runs before the transaction starts (`leadService.ts:86` versus `:92`). Also, the form lets the user pick any stage (`create-lead-form.tsx`, the `stage` select) and the service stores it without a transition check; a new lead can start as `WON`.

## Flow: Update lead stage with workflow validation
1. `src/components/leads/lead-edit-form.tsx` — form submit calls `updateLead.mutateAsync()`
2. `src/hooks/use-lead-detail.ts` — `useUpdateLead()` fires `PATCH /api/leads/[leadId]`
3. `src/app/api/leads/[leadId]/route.ts` — `PATCH()`
4. `src/lib/middleware/withAuth.ts` — `withAuth()` authenticates the caller
5. `src/lib/validation/leadSchemas.ts` — `updateLeadSchema.parse()`
6. `src/services/leadService.ts` — `updateLeadRecord()` calls `assertValidStageTransition()`, checks reassignment rules, updates the lead, and records activity
7. `src/repositories/leadRepository.ts` — `findLeadById()` and `updateLead()`
8. `src/repositories/activityRepository.ts` — `createActivityLog()` writes `STAGE_CHANGED`, `OWNER_CHANGED`, or `DETAILS_UPDATED`
9. Returns updated lead card JSON

**Correction (step 6 order):** inside `updateLeadRecord()` the order is: load lead (`:125`), `canEditLead` (`:131`), reassignment rule (`:135`), new-owner lookup (`:139-145`), then the stage check (`:147-149`), then the transaction (`:151`). Reassignment is checked before the stage, not after.

**Correction (step 8, "or"):** the three log types are not alternatives. A single save can write all three. Because the edit form sends every field (`lead-edit-form.tsx:48-51`), every UI save writes `DETAILS_UPDATED`, plus `STAGE_CHANGED` if the stage moved, plus `OWNER_CHANGED` if the owner moved (`leadService.ts:168-205`).

## Flow: Reject a rep filtering another owner’s dashboard
1. `src/tests/auth-route-guards.test.ts` — issues a request to `/api/dashboard?ownerId=manager-user`
2. `src/app/api/dashboard/route.ts` — `GET()` parses the query string
3. `src/lib/middleware/withAuth.ts` — `withAuth()` supplies the authenticated rep
4. `src/lib/validation/leadSchemas.ts` — `leadFilterSchema.parse()`
5. `src/lib/middleware/withRole.ts` — `withRole(user, ["ADMIN", "MANAGER"])` rejects the request
6. `src/lib/http/responses.ts` — `toErrorResponse()` turns the thrown `ApiError` into JSON
7. Returns `403` with `{ error, code: "FORBIDDEN" }`

**Correction (steps 2-3):** `withAuth()` runs first (`dashboard/route.ts:19`), and the query string is parsed inside the handler (`:20`). In the test, `withAuth` is replaced by `vi.doMock` (`auth-route-guards.test.ts:9-19`) with a stub that always passes a rep; the real cookie and JWT code does not run in this test. Step 6 works on this route only because of `return await` on line 19; see [`../architecture/request-lifecycle.md`](../architecture/request-lifecycle.md).

## Flow: Add note and refresh the activity timeline
1. `src/components/leads/note-form.tsx` — submit calls `addNote.mutateAsync()`
2. `src/hooks/use-lead-detail.ts` — `useAddNote()` fires `POST /api/leads/[leadId]/notes`
3. `src/app/api/leads/[leadId]/notes/route.ts` — `POST()`
4. `src/lib/middleware/withAuth.ts` — `withAuth()` authenticates the caller
5. `src/lib/validation/leadSchemas.ts` — `createNoteSchema.parse()`
6. `src/services/noteService.ts` — `addLeadNote()` verifies parent access and starts a transaction
7. `src/repositories/leadRepository.ts` — `findLeadById()` loads the parent lead and owner
8. `src/repositories/noteRepository.ts` — `createNote()` inserts the note
9. `src/repositories/activityRepository.ts` — `createActivityLog()` records `NOTE_ADDED`
10. `src/hooks/use-lead-detail.ts` — invalidates `["lead-detail", leadId]` and `["dashboard"]`
11. `src/components/leads/activity-timeline.tsx` — rerenders with the refreshed audit trail

Step 6 uses `canAccessLead` (`noteService.ts:23`), the read permission, not `canEditLead`. For the current roles the two give the same answer, so anyone who can see a lead can annotate it. If a read-only role is added later, it will be able to add notes unless this changes.

## Flow: Complete follow-up and recompute lead summary
1. `src/components/leads/follow-up-form.tsx` — click handler calls `updateFollowUpStatus.mutate()`
2. `src/hooks/use-lead-detail.ts` — `useUpdateFollowUpStatus()` fires `PATCH /api/follow-ups/[followUpId]`
3. `src/app/api/follow-ups/[followUpId]/route.ts` — `PATCH()`
4. `src/lib/middleware/withAuth.ts` — `withAuth()` authenticates the caller
5. `src/lib/validation/leadSchemas.ts` — `updateFollowUpStatusSchema.parse()`
6. `src/services/followUpService.ts` — `changeFollowUpStatus()` enforces that only pending follow-ups can transition, updates the row, and calls `syncLeadNextFollowUp()`
7. `src/repositories/followUpRepository.ts` — `findFollowUpById()`, `updateFollowUpStatus()`, and `listPendingFollowUpsForLead()`
8. `src/repositories/leadRepository.ts` — `updateLeadNextFollowUp()`
9. `src/repositories/activityRepository.ts` — `createActivityLog()` records completion or cancellation
10. Returns updated follow-up JSON

Step 1 detail: the Complete and Cancel buttons are rendered for every `PENDING` follow-up on the page (`follow-up-form.tsx`, the `followUp.status === "PENDING"` block), with no `disabled` state while the mutation is in flight. The buttons are shown to everyone who can see the lead, including users the server will reject. A double click sends two PATCH requests; see the race trace below.

## Failure trace: Rep opens another rep's lead

Setup: lead `L1` is owned by `rep2`. `rep` is logged in.

| Step | Code | Result |
| --- | --- | --- |
| 1 | `src/app/leads/[leadId]/page.tsx:17` | `requirePageSession()` passes; page renders |
| 2 | `use-lead-detail.ts`, `useLeadDetail()` | `GET /api/leads/L1` |
| 3 | `leads/[leadId]/route.ts:18` | `return withAuth(...)` (no `await`) |
| 4 | `withAuth.ts:18-26` | session valid, handler runs |
| 5 | `leadService.ts:55` | `findLeadById()` loads the full lead tree |
| 6 | `leadService.ts:61-63` | `canAccessLead(rep, "rep2")` is false; throws `ApiError 403 LEAD_ACCESS_DENIED` |
| 7 | route `catch` | does not run (missing `await`) |
| 8 | Next.js | uncaught error, 500 |
| 9 | `client.ts:17-23` | the 500 body is not this app's `{ error, code }` shape, so `errorPayload?.error` is missing; throws `Error("Request failed.")` |
| 10 | `lead-detail-page.tsx:43-47` | shows "Request failed." |

Steps 5-7 are read from the cited lines. Step 8 is what Next.js does with an uncaught route error; it was not run here.

Note step 5: the full lead, with every note and activity row, was read from the database before the permission check. Nothing is returned to the client, but the work was done.

## Race trace: Complete and Cancel arrive together

Setup: follow-up `F1` is `PENDING`. Request A is `rep` clicking Complete. Request B is a manager clicking Cancel at about the same time. Each line is one awaited step. The table shows one possible interleaving; it is reasoned from the code, not recorded from a run.

| Time | Request A (COMPLETED) | Request B (CANCELED) |
| --- | --- | --- |
| 1 | `findFollowUpById` → status `PENDING` (`followUpService.ts:86`) | |
| 2 | | `findFollowUpById` → status `PENDING` |
| 3 | `canManageFollowUp` ok, status check ok (`:92`, `:96`) | |
| 4 | | `canManageFollowUp` ok, status check ok |
| 5 | transaction: `update ... status=COMPLETED, completedAt=now` | |
| 6 | | transaction: `update ... status=CANCELED, completedAt=null` |
| 7 | `syncLeadNextFollowUp`, log `FOLLOW_UP_COMPLETED` | |
| 8 | | `syncLeadNextFollowUp`, log `FOLLOW_UP_CANCELED` |
| end | 200 | 200 |

Final state for this interleaving: status `CANCELED`, `completedAt: null`, and two timeline rows that contradict each other. Rep A was told their completion succeeded.

Why the transaction does not help: the read on line 86 and the check on line 96 happen before `db.$transaction()` on line 102, and `updateFollowUpStatus()` writes with `where: { id: followUpId }` only (`followUpRepository.ts:108-109`). The same interleaving is possible on real Postgres because nothing locks the row between the read and the write.

Double click variant: two `COMPLETED` requests both pass, and the timeline gets two `FOLLOW_UP_COMPLETED` rows. `completedAt` ends up as the second request's time.

Fix, inside the transaction:

```ts
const { count } = await transaction.followUp.updateMany({
  where: { id: followUpId, status: "PENDING" },
  data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
});
if (count === 0) {
  throw new ApiError("Only pending follow-ups can change status.", 409, "INVALID_FOLLOW_UP_TRANSITION");
}
```

The database then decides which request wins. The loser gets 409 and writes no log row, because the throw rolls back its transaction.

## Race trace: Two stage changes on one lead

Setup: lead `L1` is in `NEGOTIATION`. Request A moves it to `WON`; request B moves it to `LOST`.

| Time | Request A (`WON`) | Request B (`LOST`) |
| --- | --- | --- |
| 1 | `findLeadById` → `NEGOTIATION` (`leadService.ts:125`) | |
| 2 | | `findLeadById` → `NEGOTIATION` |
| 3 | `NEGOTIATION -> WON` allowed (`:147-149`) | |
| 4 | | `NEGOTIATION -> LOST` allowed |
| 5 | `updateLead(... stage: WON)` | |
| 6 | | `updateLead(... stage: LOST)` |
| 7 | log `STAGE_CHANGED from NEGOTIATION to WON` | log `STAGE_CHANGED from NEGOTIATION to LOST` |
| end | 200 | 200 |

Final state for this interleaving: stage `LOST`, timeline shows the lead moving from `NEGOTIATION` to both `WON` and `LOST`. `WON -> LOST` is not a legal transition, but that is effectively what happened.

Fix: in the transaction, `updateMany({ where: { id: leadId, stage: lead.stage }, data })` and throw 409 when `count === 0`. An `updatedAt`-based optimistic lock works the same way and also covers non-stage fields.

## Race trace: Two follow-ups scheduled at once (by reading)

Setup: lead `L1` has no pending follow-ups. Request A schedules one due 1 February; request B schedules one due 1 January.

1. A's transaction inserts its row, then `listPendingFollowUpsForLead()` (`followUpRepository.ts:67-75`) sees only its own row, since B has not committed. It computes 1 February.
2. B's transaction does the same and computes 1 January.
3. B commits, writing `nextFollowUpAt = 1 January`.
4. A commits, writing `nextFollowUpAt = 1 February`.

The lead now says its next follow-up is 1 February while a 1 January follow-up is pending. Nothing repairs it until the next follow-up change on that lead. It follows from Postgres READ COMMITTED semantics and the absence of a row lock on the lead. Fix: `SELECT ... FOR UPDATE` on the lead row at the start of the transaction (a raw query in Prisma), or compute `nextFollowUpAt` at read time instead of storing it.

## Trace exercises

1. In the Complete/Cancel race, which user sees an error? Answer: neither. Both get 200. After the `updateMany` fix, the second request gets 409.
2. Would wrapping lines 86-100 of `followUpService.ts` inside the existing transaction be enough on Postgres? Answer: no, not at READ COMMITTED. Both transactions can still read `PENDING` before either writes. You need a conditional write (`updateMany` with `status: "PENDING"`), a row lock, or SERIALIZABLE isolation.
3. A manager reassigns lead `L1` from `rep` to `rep2`. Who can now complete `L1`'s existing pending follow-ups? Answer: `rep` (still the follow-up owner) and any manager or admin. `rep2`, the new lead owner, cannot (`followUpService.ts:92`).
