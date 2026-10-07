# Guided Reading Path

## Step 1 — src/app/api/dashboard/route.ts
**Why read this:** It is the cleanest entry point into the request lifecycle because it shows auth, validation, role checks, and a service call in one small file.
**What to look for:** The sequence `withAuth()` -> `leadFilterSchema` -> `withRole()` -> `getDashboardData()`.
**What to trace:** Called by `src/hooks/use-dashboard.ts`; calls `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, and `src/services/dashboardService.ts`.
**What a junior would likely miss:** The `ownerId` filter itself is permission-sensitive, even though it looks like a harmless query parameter.
**Also notice:** line 19 says `return await withAuth(...)`. That `await` is why this route's `catch` works. Compare it with any other route file in Step 2's exercise. And note that the UI never sends `ownerId`: `buildDashboardUrl()` in `src/hooks/use-dashboard.ts:87-104` only sets `stage`, `search` and `mineOnly`. The `withRole` branch on lines 22-26 is reachable only by calling the API directly.

## Step 2 — src/lib/middleware/withAuth.ts
**Why read this:** It is the actual API auth gate.
**What to look for:** How the route handler receives an `AuthContext` only after session verification.
**What to trace:** Called by multiple route files under `src/app/api/`; calls `src/lib/auth/session.ts`.
**What a junior would likely miss:** UI redirects are not security; this route wrapper is.
**Also notice:** the wrapper returns the handler's promise and catches nothing (lines 14-27). Error mapping is the caller's job, and six of seven callers do not `await` it.

## Step 3 — src/lib/auth/session.ts
**Why read this:** It shows how page auth and API auth share one cookie contract.
**What to look for:** `createSession()`, `getRequestSession()`, and `requirePageSession()`.
**What to trace:** Called by `src/app/api/auth/login/route.ts`, `src/lib/middleware/withAuth.ts`, `src/app/page.tsx`, and `src/app/leads/[leadId]/page.tsx`; calls `src/lib/env.ts`.
**What a junior would likely miss:** The cookie payload is intentionally smaller than the Prisma user model.
**Also called by:** `src/app/login/page.tsx:14` (`getPageSession()`) and `src/app/api/auth/logout/route.ts:13` (`destroySession()`).

## Step 4 — src/lib/validation/leadSchemas.ts
**Why read this:** It defines the input boundary for most business actions.
**What to look for:** Separate schemas for create lead, patch lead, note creation, and follow-up status changes.
**What to trace:** Called by route files in `src/app/api/leads/**` and `src/app/api/follow-ups/[followUpId]/route.ts`.
**What a junior would likely miss:** `PATCH` validation should not look identical to `POST` validation.
**Also notice:** the PATCH schema is derived from the POST schema with `.partial()` (line 39), and the POST schema has `stage: ... .default("NEW")` (line 34). The default survives `.partial()`. That one line turns every PATCH that omits `stage` into a request to move the lead back to `NEW`. See [`../architecture/domain-model.md`](../architecture/domain-model.md), "Stage machine".

## Step 5 — src/services/dashboardService.ts
**Why read this:** It is the first service-layer read model and the first ownership-scope composition point.
**What to look for:** `getLeadVisibility()` and `getAssignableUsersForViewer()`.
**What to trace:** Called by `src/app/api/dashboard/route.ts` and `src/app/leads/[leadId]/page.tsx`; calls `src/repositories/leadRepository.ts`, `src/repositories/followUpRepository.ts`, and `src/repositories/userRepository.ts`.
**What a junior would likely miss:** Assignment options themselves are security-sensitive data.

## Step 6 — src/repositories/leadRepository.ts
**Why read this:** It is where read scoping becomes a Prisma query.
**What to look for:** `buildLeadWhere()` and the consistent include trees used by `listLeads()` and `findLeadById()`.
**What to trace:** Called by `src/services/dashboardService.ts`, `src/services/leadService.ts`, `src/services/noteService.ts`, and `src/services/followUpService.ts`.
**What a junior would likely miss:** One forgotten `ownerId` condition here becomes a systemic data leak.
**Also notice:** `findLeadById()` (lines 97-162) has no scope parameter at all. Single-record access is protected only by the service-level `canAccessLead()` and `canEditLead()` calls.

## Step 7 — src/services/leadService.ts
**Why read this:** It owns the highest-value business logic in the app.
**What to look for:** `assertValidStageTransition()`, `createLeadRecord()`, and `updateLeadRecord()`.
**What to trace:** Called by `src/app/api/leads/route.ts` and `src/app/api/leads/[leadId]/route.ts`; calls `src/repositories/leadRepository.ts`, `src/repositories/userRepository.ts`, and `src/repositories/activityRepository.ts`.
**What a junior would likely miss:** Updating a lead is not a generic patch; different fields imply different rules and audit events.
**Also notice:** all checks in `updateLeadRecord()` run on a row read before the transaction (line 125). The transaction (line 151) only groups the write with its logs.

## Step 8 — src/services/followUpService.ts
**Why read this:** It demonstrates a parent-child workflow with a denormalized summary field.
**What to look for:** `syncLeadNextFollowUp()` and `changeFollowUpStatus()`.
**What to trace:** Called by `src/app/api/leads/[leadId]/follow-ups/route.ts` and `src/app/api/follow-ups/[followUpId]/route.ts`; calls `src/repositories/followUpRepository.ts`, `src/repositories/leadRepository.ts`, and `src/repositories/activityRepository.ts`.
**What a junior would likely miss:** Child updates often require parent updates to keep operational screens fast.
**Also notice:** creation checks the lead owner (`canEditLead`, line 41) but status changes check the follow-up owner (`canManageFollowUp`, line 92). Two different ownership rules for the same child resource.

## Step 9 — src/services/noteService.ts
**Why read this:** It is the smallest example of parent-entity authorization plus audit logging.
**What to look for:** The parent lead access check before note creation.
**What to trace:** Called by `src/app/api/leads/[leadId]/notes/route.ts`; calls `src/repositories/leadRepository.ts`, `src/repositories/noteRepository.ts`, and `src/repositories/activityRepository.ts`.
**What a junior would likely miss:** Child resources almost always inherit the parent’s auth boundary.

## Step 10 — src/hooks/use-dashboard.ts
**Why read this:** It shows how the client talks HTTP without owning business rules.
**What to look for:** Query keys, mutation invalidation, and how filters become URL params.
**What to trace:** Called by `src/components/dashboard/dashboard-page.tsx`; calls `src/lib/http/client.ts`.
**What a junior would likely miss:** Cache invalidation is part of correctness, not just UX polish.

## Step 11 — src/components/dashboard/dashboard-page.tsx
**Why read this:** It shows the intended React shape for a CRUD dashboard backed by a clean service layer.
**What to look for:** Deferred search state, query-driven rendering, and composition of smaller components.
**What to trace:** Called by `src/app/page.tsx`; calls `src/hooks/use-dashboard.ts`, `src/components/dashboard/create-lead-form.tsx`, `src/components/dashboard/summary-cards.tsx`, and `src/components/dashboard/pipeline-board.tsx`.
**What a junior would likely miss:** This component owns page state and rendering state, not domain rules.
**Also notice:** `mineOnly` starts as `true` for reps (line 25). For a rep it changes nothing on the server, because `getLeadVisibility()` already scopes them; it matters for managers who tick the box.

## Step 12 — src/components/leads/lead-detail-page.tsx
**Why read this:** It shows how one canonical query feeds several mutation subfeatures without fragmenting the data model.
**What to look for:** One `useLeadDetail()` call feeding edit, note, follow-up, and activity subcomponents.
**What to trace:** Called by `src/app/leads/[leadId]/page.tsx`; calls `src/hooks/use-lead-detail.ts`, `src/components/leads/lead-edit-form.tsx`, `src/components/leads/note-form.tsx`, `src/components/leads/follow-up-form.tsx`, and `src/components/leads/activity-timeline.tsx`.
**What a junior would likely miss:** A shared detail query is often better than separate sub-resource queries when the screen needs coherent invalidation.

## Exercises, one per step

Do these with the code open. Answers follow each question.

1. **Step 1.** A rep calls `GET /api/dashboard?ownerId=<their own id>`. Does `withRole` run? Answer: no. Line 22 only calls it when `filters.ownerId !== user.id`.
2. **Step 2.** Open `src/app/api/leads/[leadId]/route.ts`. What status does a client get from `GET` with no cookie? Answer: 500, not 401. Line 18 has `return withAuth(...)` without `await`, so the `catch` on line 22 never sees the rejection.
3. **Step 3.** How long does a session last, and where is that set twice? Answer: 7 days, in `setExpirationTime("7d")` (line 26) for the JWT and `maxAge: 60 * 60 * 24 * 7` (line 54) for the cookie. If they ever disagree, the shorter one wins in practice.
4. **Step 4.** What does `updateLeadSchema.parse({})` return? Answer: `{ stage: "NEW" }`. It does not throw, even though lines 40-47 try to reject empty bodies.
5. **Step 5.** For a rep, which users does `getAssignableUsersForViewer()` return? Answer: only the rep (line 29). The full list is still loaded from the database first (line 21) and filtered in memory.
6. **Step 6.** `buildLeadWhere({ ownerId: "a" }, { ownerId: "b" })` builds what? Answer: `{ AND: [{ ownerId: "a" }, { ownerId: "b" }] }`, which matches nothing. A rep cannot widen their scope with a filter, and the route already rejects that case with 403 before it gets here.
7. **Step 7.** A manager sends `PATCH { ownerId: "<rep2>" }` on a `PROPOSAL` lead. What happens? Answer: 409 `INVALID_STAGE_TRANSITION` from the injected `stage: "NEW"`, surfaced as 500 by the route. The reassignment never happens.
8. **Step 8.** Which value does `syncLeadNextFollowUp()` write when the last pending follow-up is completed? Answer: `null` (line 26, `pending[0]?.dueAt ?? null`). `listLeads()` orders by `nextFollowUpAt` ascending (`leadRepository.ts:79`); Postgres puts nulls last in ascending order by default, so leads with nothing scheduled sink to the bottom.
9. **Step 9.** Which permission helper does note creation use, read or edit? Answer: `canAccessLead`, the read helper (line 23). For the current roles, read and edit give the same answer.
10. **Step 10.** After creating a lead, which queries are invalidated? Answer: only `["dashboard"]` (`use-dashboard.ts:123`). No lead-detail cache exists for a new lead yet, so that is enough.
11. **Step 11.** Where does the stage filter from the dashboard reach the database, and does it affect the stage counts? Answer: it goes to `listLeads()` through `buildLeadWhere()`. It does not affect the counts: `getDashboardData()` passes only `ownerId` and `search` to `getLeadStageCounts()` (`dashboardService.ts:37`), so the per-stage totals stay visible while one stage is selected.
12. **Step 12.** A rep opens `/leads/<id of another rep's lead>`. Does the server component stop them? Answer: no. `src/app/leads/[leadId]/page.tsx` only checks that a session exists. The data request `GET /api/leads/:id` is what denies access, and the page shows the error from that request.

## Reading rungs after the 12 steps

Once the twelve steps make sense, these short reads cover what the main path skips:

| Rung | File | Question to answer while reading | Answer |
| --- | --- | --- | --- |
| 13 | `src/lib/http/responses.ts` | Which thrown values become 400? | Only `ZodError` (lines 26-35). Malformed JSON (`SyntaxError`) becomes 500. |
| 14 | `src/lib/http/request.ts` | Do unknown query keys reach the service? | No. `leadFilterSchema` is a plain `z.object`, which strips unknown keys by default. |
| 15 | `src/lib/env.ts` | When does a missing secret fail? | At import of `session.ts` (line 5), so the first page or route that touches auth fails with a Zod error. |
| 16 | `src/repositories/followUpRepository.ts` | How many upcoming follow-ups does the dashboard show? | 8, ordered by `dueAt` (lines 40-41). Overdue items come first because they have the earliest dates. |
| 17 | `prisma/seed.ts` | Who owns the seeded leads? | The rep, all three (line 126). |
| 18 | `src/components/leads/follow-up-form.tsx` | Can a rep schedule a follow-up for a manager from the UI? | No; the owner select is disabled for reps and filtered to themselves. The server enforces the same rule (`followUpService.ts:45-47`). |
