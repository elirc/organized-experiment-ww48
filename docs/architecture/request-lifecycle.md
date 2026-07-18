# Request Lifecycle

Request: Login with credentials
1. `src/app/api/auth/login/route.ts` — `POST()` parses the request body with `loginSchema`.
2. `src/lib/validation/authSchemas.ts` — `loginSchema.parse()` validates email/password shape.
3. `src/services/authService.ts` — `authenticateUser()` loads the user and verifies the password.
4. `src/repositories/userRepository.ts` — `findUserByEmail()` issues the Prisma lookup.
5. `src/lib/auth/password.ts` — `verifyPassword()` compares the submitted password to the stored hash.
6. `src/lib/auth/session.ts` — `createSession()` signs the cookie.
7. Returns `200` with `{ user }`

Request: Create a lead from the dashboard
1. `src/components/dashboard/create-lead-form.tsx` — submit calls `useCreateLead().mutateAsync()`.
2. `src/hooks/use-dashboard.ts` — `useCreateLead()` sends `POST /api/leads`.
3. `src/app/api/leads/route.ts` — `POST()` authenticates and parses the payload.
4. `src/lib/middleware/withAuth.ts` — `withAuth()` verifies the session before the handler runs.
5. `src/lib/validation/leadSchemas.ts` — `createLeadSchema.parse()` validates the request body.
6. `src/services/leadService.ts` — `createLeadRecord()` enforces owner assignment rules and opens a transaction.
7. `src/repositories/userRepository.ts` — `findUserById()` verifies the assigned owner exists and is active.
8. `src/repositories/leadRepository.ts` — `createLead()` writes the lead row.
9. `src/repositories/activityRepository.ts` — `createActivityLog()` writes the audit entry in the same transaction.
10. Returns `201` with the created lead card payload

Request: Add a note to an existing lead
1. `src/components/leads/note-form.tsx` — submit calls `useAddNote().mutateAsync()`.
2. `src/hooks/use-lead-detail.ts` — `useAddNote()` sends `POST /api/leads/[leadId]/notes`.
3. `src/app/api/leads/[leadId]/notes/route.ts` — `POST()` authenticates and parses the note body.
4. `src/lib/middleware/withAuth.ts` — `withAuth()` loads the session.
5. `src/lib/validation/leadSchemas.ts` — `createNoteSchema.parse()` validates `body`.
6. `src/services/noteService.ts` — `addLeadNote()` verifies the caller can access the parent lead.
7. `src/repositories/leadRepository.ts` — `findLeadById()` loads the lead and owner.
8. `src/repositories/noteRepository.ts` — `createNote()` writes the note.
9. `src/repositories/activityRepository.ts` — `createActivityLog()` records `NOTE_ADDED`.
10. Returns `201` with the created note payload

Request: Complete a follow-up
1. `src/components/leads/follow-up-form.tsx` — button click calls `useUpdateFollowUpStatus().mutate()`.
2. `src/hooks/use-lead-detail.ts` — `useUpdateFollowUpStatus()` sends `PATCH /api/follow-ups/[followUpId]`.
3. `src/app/api/follow-ups/[followUpId]/route.ts` — `PATCH()` authenticates and parses the status change.
4. `src/lib/middleware/withAuth.ts` — `withAuth()` verifies the session.
5. `src/lib/validation/leadSchemas.ts` — `updateFollowUpStatusSchema.parse()` restricts statuses to `COMPLETED` or `CANCELED`.
6. `src/services/followUpService.ts` — `changeFollowUpStatus()` checks ownership, blocks invalid transitions, updates the row, and recomputes `Lead.nextFollowUpAt`.
7. `src/repositories/followUpRepository.ts` — `findFollowUpById()` and `updateFollowUpStatus()` read and write the follow-up.
8. `src/repositories/leadRepository.ts` — `updateLeadNextFollowUp()` keeps the parent lead summary in sync.
9. `src/repositories/activityRepository.ts` — `createActivityLog()` records completion or cancellation.
10. Returns `200` with the updated follow-up payload

Request: Rep tries to filter another owner’s dashboard
1. `src/app/api/dashboard/route.ts` — `GET()` parses `ownerId=manager-user` from the query string.
2. `src/lib/middleware/withAuth.ts` — `withAuth()` authenticates the rep.
3. `src/lib/validation/leadSchemas.ts` — `leadFilterSchema.parse()` normalizes the query params.
4. `src/lib/middleware/withRole.ts` — `withRole(user, ["ADMIN", "MANAGER"])` rejects the request because the rep asked for another owner’s data.
5. Returns `403` with `{ error, code: "FORBIDDEN" }`

