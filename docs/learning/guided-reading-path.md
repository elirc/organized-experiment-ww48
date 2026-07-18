# Guided Reading Path

## Step 1 — src/app/api/dashboard/route.ts
**Why read this:** It is the cleanest entry point into the request lifecycle because it shows auth, validation, role checks, and a service call in one small file.
**What to look for:** The sequence `withAuth()` -> `leadFilterSchema` -> `withRole()` -> `getDashboardData()`.
**What to trace:** Called by `src/hooks/use-dashboard.ts`; calls `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, and `src/services/dashboardService.ts`.
**What a junior would likely miss:** The `ownerId` filter itself is permission-sensitive, even though it looks like a harmless query parameter.

## Step 2 — src/lib/middleware/withAuth.ts
**Why read this:** It is the actual API auth gate.
**What to look for:** How the route handler receives an `AuthContext` only after session verification.
**What to trace:** Called by multiple route files under `src/app/api/`; calls `src/lib/auth/session.ts`.
**What a junior would likely miss:** UI redirects are not security; this route wrapper is.

## Step 3 — src/lib/auth/session.ts
**Why read this:** It shows how page auth and API auth share one cookie contract.
**What to look for:** `createSession()`, `getRequestSession()`, and `requirePageSession()`.
**What to trace:** Called by `src/app/api/auth/login/route.ts`, `src/lib/middleware/withAuth.ts`, `src/app/page.tsx`, and `src/app/leads/[leadId]/page.tsx`; calls `src/lib/env.ts`.
**What a junior would likely miss:** The cookie payload is intentionally smaller than the Prisma user model.

## Step 4 — src/lib/validation/leadSchemas.ts
**Why read this:** It defines the input boundary for most business actions.
**What to look for:** Separate schemas for create lead, patch lead, note creation, and follow-up status changes.
**What to trace:** Called by route files in `src/app/api/leads/**` and `src/app/api/follow-ups/[followUpId]/route.ts`.
**What a junior would likely miss:** `PATCH` validation should not look identical to `POST` validation.

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

## Step 7 — src/services/leadService.ts
**Why read this:** It owns the highest-value business logic in the app.
**What to look for:** `assertValidStageTransition()`, `createLeadRecord()`, and `updateLeadRecord()`.
**What to trace:** Called by `src/app/api/leads/route.ts` and `src/app/api/leads/[leadId]/route.ts`; calls `src/repositories/leadRepository.ts`, `src/repositories/userRepository.ts`, and `src/repositories/activityRepository.ts`.
**What a junior would likely miss:** Updating a lead is not a generic patch; different fields imply different rules and audit events.

## Step 8 — src/services/followUpService.ts
**Why read this:** It demonstrates a parent-child workflow with a denormalized summary field.
**What to look for:** `syncLeadNextFollowUp()` and `changeFollowUpStatus()`.
**What to trace:** Called by `src/app/api/leads/[leadId]/follow-ups/route.ts` and `src/app/api/follow-ups/[followUpId]/route.ts`; calls `src/repositories/followUpRepository.ts`, `src/repositories/leadRepository.ts`, and `src/repositories/activityRepository.ts`.
**What a junior would likely miss:** Child updates often require parent updates to keep operational screens fast.

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

## Step 12 — src/components/leads/lead-detail-page.tsx
**Why read this:** It shows how one canonical query feeds several mutation subfeatures without fragmenting the data model.
**What to look for:** One `useLeadDetail()` call feeding edit, note, follow-up, and activity subcomponents.
**What to trace:** Called by `src/app/leads/[leadId]/page.tsx`; calls `src/hooks/use-lead-detail.ts`, `src/components/leads/lead-edit-form.tsx`, `src/components/leads/note-form.tsx`, `src/components/leads/follow-up-form.tsx`, and `src/components/leads/activity-timeline.tsx`.
**What a junior would likely miss:** A shared detail query is often better than separate sub-resource queries when the screen needs coherent invalidation.

