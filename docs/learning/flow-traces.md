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

## Flow: Reject a rep filtering another owner’s dashboard
1. `src/tests/auth-route-guards.test.ts` — issues a request to `/api/dashboard?ownerId=manager-user`
2. `src/app/api/dashboard/route.ts` — `GET()` parses the query string
3. `src/lib/middleware/withAuth.ts` — `withAuth()` supplies the authenticated rep
4. `src/lib/validation/leadSchemas.ts` — `leadFilterSchema.parse()`
5. `src/lib/middleware/withRole.ts` — `withRole(user, ["ADMIN", "MANAGER"])` rejects the request
6. `src/lib/http/responses.ts` — `toErrorResponse()` turns the thrown `ApiError` into JSON
7. Returns `403` with `{ error, code: "FORBIDDEN" }`

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

