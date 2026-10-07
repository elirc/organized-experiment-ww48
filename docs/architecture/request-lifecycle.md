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

**Correction (steps 6-7):** the owner lookup in step 7 runs before the transaction, not inside it. The order in `createLeadRecord()` is: assignment rule (`leadService.ts:82-84`), then `findUserById(db, ...)` with the plain client (`:86-90`), then `db.$transaction()` (`:92`). Only the lead insert and the activity row are atomic.

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

Note on step 7: `findLeadById()` loads far more than "the lead and owner". It includes every note, follow-up and activity row of the lead (`leadRepository.ts:97-162`). `addLeadNote()` then reads only `lead.ownerId` from it (`noteService.ts:23`).

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

Note on step 6: "checks ownership" means ownership of the follow-up (`followUp.ownerId`, `followUpService.ts:92`), not of the lead. The "only pending" check reads the row before the transaction opens (`:86`, `:96`), so two concurrent clicks both pass it. Both are covered in [`../learning/flow-traces.md`](../learning/flow-traces.md).

Request: Rep tries to filter another owner’s dashboard
1. `src/app/api/dashboard/route.ts` — `GET()` parses `ownerId=manager-user` from the query string.
2. `src/lib/middleware/withAuth.ts` — `withAuth()` authenticates the rep.
3. `src/lib/validation/leadSchemas.ts` — `leadFilterSchema.parse()` normalizes the query params.
4. `src/lib/middleware/withRole.ts` — `withRole(user, ["ADMIN", "MANAGER"])` rejects the request because the rep asked for another owner’s data.
5. Returns `403` with `{ error, code: "FORBIDDEN" }`

**Correction (steps 1-3):** authentication comes first. `GET()` calls `withAuth()` on line 19 and only then parses the query string inside the handler on line 20. Steps 1 and 3 describe the same parse. The real order is: `withAuth()` → `parseSearchParams(request.url, leadFilterSchema)` → `withRole()` → `getDashboardData()`.

## What actually happens on errors

The five traces above are happy paths, plus one rejection on the only route whose error mapping works. Every authenticated route except the dashboard has a missing `await` that changes the failure path. The table below lists, per route, which failures exist and what the client receives. Every cell is read from the code; nothing here was executed.

| Route | Failure | Thrown | Status the code intends | Status the client gets |
| --- | --- | --- | --- | --- |
| `POST /api/auth/login` | bad email or short password | `ZodError` | 400 | 400 |
| | body is not JSON | `SyntaxError` | none defined | 500 |
| | unknown email, inactive user, wrong password | `ApiError 401` | 401 | 401 (same awaited path) |
| `GET /api/dashboard` | no cookie | `ApiError 401` | 401 | 401 |
| | rep filters by another owner | `ApiError 403` | 403 | 403 |
| | bad `stage` value in query | `ZodError` | 400 | 400 |
| `POST /api/leads` | no cookie | `ApiError 401` | 401 | 500 |
| | invalid body | `ZodError` | 400 | 500 |
| | rep assigns to someone else | `ApiError 403` | 403 | 500 |
| `GET /api/leads/:id` | no cookie | `ApiError 401` | 401 | 500 |
| | not found | `ApiError 404` | 404 | 500 |
| | not yours | `ApiError 403` | 403 | 500 |
| `PATCH /api/leads/:id` | no cookie | `ApiError 401` | 401 | 500 |
| | illegal stage, or any non-NEW lead without `stage` in the body | `ApiError 409` | 409 | 500 |
| `POST /api/leads/:id/notes` | no cookie | `ApiError 401` | 401 | 500 |
| `POST /api/leads/:id/follow-ups` | no cookie | `ApiError 401` | 401 | 500 |
| `PATCH /api/follow-ups/:id` | no cookie | `ApiError 401` | 401 | 500 |
| | already completed or canceled | `ApiError 409` | 409 | 500 |

For the six unawaited routes, the handler's promise rejects with the thrown error instead of resolving to a `Response`. The final 500 is what Next.js does with an uncaught error from a route handler. Confirm it once in your own environment with `curl -i` against `GET /api/leads/<id>` and no cookie.

### Why the `catch` does not run

The six handlers look like this (`src/app/api/leads/[leadId]/route.ts:16-25`):

```ts
try {
  return withAuth(request, async ({ user }) => { ... });
} catch (error) {
  return toErrorResponse(error);
}
```

`withAuth` is `async`, so the call returns a pending promise straight away. The `try` block finishes successfully the moment it hands that promise back. When the promise later rejects, the function has already left the `try`. The `catch` is dead code for every error that happens inside `withAuth` or the handler, which is all of them.

The dashboard writes `return await withAuth(...)` (`src/app/api/dashboard/route.ts:19`). The `await` keeps execution inside the `try` until the promise settles, so a rejection becomes a thrown error that the `catch` can see.

This is also why the one route-level test passes. `src/tests/auth-route-guards.test.ts` tests the dashboard, the only route where the mapping works. The same test pointed at `GET /api/leads/:id` would fail.

## Request: Edit a lead through the API without `stage`

This trace shows the schema default problem from [`domain-model.md`](domain-model.md). Setup: lead `L1` is in `QUALIFIED`, owned by the caller.

1. Client sends `PATCH /api/leads/L1` with body `{ "companyName": "Acme Co" }`.
2. `src/app/api/leads/[leadId]/route.ts:32` — `withAuth()` passes.
3. `:34` — `parseJsonBody(request, updateLeadSchema)` returns `{ companyName: "Acme Co", stage: "NEW" }`. The `stage` key was added by `.default("NEW")` (`leadSchemas.ts:34`), which `.partial()` does not remove.
4. `src/services/leadService.ts:125` — `findLeadById()` loads the lead (stage `QUALIFIED`).
5. `:131` — `canEditLead()` passes.
6. `:135`, `:139` — no `ownerId` in input, skipped.
7. `:147-149` — `input.stage` is `"NEW"`, so `assertValidStageTransition("QUALIFIED", "NEW")` runs and throws `ApiError(409, "INVALID_STAGE_TRANSITION")`.
8. Because of the missing `await`, the 409 escapes the route and the client sees a 500.

The browser form never triggers this because it always sends the current stage (`src/components/leads/lead-edit-form.tsx:27-37`).

## Request: Unauthenticated read of a lead

1. Client sends `GET /api/leads/L1` with no cookie.
2. `src/app/api/leads/[leadId]/route.ts:18` — `return withAuth(...)`.
3. `src/lib/middleware/withAuth.ts:18` — `getRequestSession()` finds no `crm_session` entry and returns `null` (`session.ts:30-33`).
4. `withAuth.ts:23` — throws `ApiError(401, "UNAUTHORIZED")`. The returned promise rejects.
5. The route's `catch` does not run. No service code ran, nothing was read from the database.
6. Next.js logs the error and responds 500.

Security outcome: correct, no data leaves. Contract outcome: wrong status code.

## Request: Load the lead detail page

This path has two halves, and the trace in the original docs only covered the API half.

1. Browser requests `/leads/L1`.
2. `src/app/leads/[leadId]/page.tsx:17` — `requirePageSession()` reads the cookie with `next/headers`. No session means `redirect("/login")` (`session.ts:71-73`).
3. `:19-23` — `getAssignableUsersForViewer(viewer)` loads all active users and, for a rep, keeps only the rep (`dashboardService.ts:20-30`). The page passes `id`, `name`, `role` to the client component.
4. The page renders `LeadDetailPage` without checking whether the viewer may see `L1`. The id is only passed through.
5. In the browser, `useLeadDetail(L1)` (`src/hooks/use-lead-detail.ts`, `useQuery` with key `["lead-detail", leadId]`) calls `GET /api/leads/L1`.
6. That request runs `getLeadDetail()`, which enforces `canAccessLead()`.
7. On denial, `apiFetch()` throws `Error("Request failed.")` (because the 403 became a 500 without the app's JSON shape), and `lead-detail-page.tsx` shows that message in a red box.

## Exercises

1. In which order do these run for `PATCH /api/follow-ups/F1`: Zod parse, `withAuth`, `findFollowUpById`, `canManageFollowUp`, status check, transaction? Answer: `withAuth` (route line 21), Zod parse (line 23), `findFollowUpById` (`followUpService.ts:86`), `canManageFollowUp` (`:92`), status check (`:96`), transaction (`:102`).
2. A rep with no cookie sends `POST /api/leads` with an invalid body. Which error wins? Answer: the 401. `withAuth` throws before the handler body, so the Zod parse never runs.
3. After adding `await` to all six handlers, what would a rep see when opening another rep's lead? Answer: HTTP 403 with `{ error: "You do not have access to this lead.", code: "LEAD_ACCESS_DENIED" }`, and the UI would show that message instead of "Request failed.".
4. Which of the six routes would still return 500 for a body that is not JSON after that fix? Answer: all five that parse a body, because `SyntaxError` is not mapped in `toErrorResponse()` (`responses.ts:25-59`). `GET /api/leads/:id` has no body.
