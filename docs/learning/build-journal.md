# Build Journal

## Stage 1 — Architecture framing
- Built: the project skeleton and the initial boundary plan.
- Decision: stayed with Next.js App Router, REST, Prisma, PostgreSQL, Tailwind, Zod, and React Query because the request lifecycle stays easy to trace in code.
- Why: this stack is realistic for backend-heavy corporate CRUD apps and teaches explicit boundaries better than hiding everything behind generated RPC layers.
- Decision: kept the app single-tenant for now, with explicit owner scoping instead of tenant scoping.
- Options considered:
  - Full multi-tenancy now: realistic for some SaaS CRMs, but would add tenant context to every example before the core CRUD patterns were even visible.
  - Single-tenant with owner-aware access control: simpler teaching surface while preserving a clear future insertion point for `tenantId`.
- Chosen: single-tenant plus owner-based isolation in `src/services/dashboardService.ts` and `src/repositories/leadRepository.ts`.
- Why chosen: the requirements did not force multi-tenancy, and this keeps the code focused on service/repository thinking without pretending auth is optional.
- Junior notice: “users have roles and owners.”
- Mid-level notice: “visibility is explicit and centralized.”
- Senior notice: “the repository contract already leaves room to add tenant filters later.”

## Decision log — REST versus tRPC
- Why the decision mattered: the project is teaching how requests move through files, and the transport choice changes how visible that is.
- Options considered:
  - tRPC: strong type sharing and less endpoint boilerplate, but it hides the HTTP boundary the project is trying to teach.
  - REST with explicit route files: slightly more boilerplate, but the lifecycle is visible from component to route to service to repository.
- Chosen: REST in `src/app/api/**/route.ts`.
- Why chosen: it makes `request-lifecycle.md` and the code-reading experience much clearer for a junior-to-mid engineer learning backend-oriented product engineering.
- Junior notice: “there is a URL for each action.”
- Mid-level notice: “validation and auth happen at a visible edge.”
- Senior notice: “reviewability and explicit boundaries sometimes matter more than minimizing files.”

## Stage 2 — Domain model and persistence
- Built: `prisma/schema.prisma`, `prisma/seed.ts`, and repository/client groundwork in `src/lib/db.ts` and `src/repositories/`.
- Decision: used Prisma instead of Drizzle.
- Why: Prisma gave the fastest path to readable relational models, generated types, and transaction-friendly repository code for a teaching-oriented CRUD app.

## Stage 3 — Auth, RBAC, and request boundaries
- Built: `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, and route parsing helpers.
- Decision: used signed cookie sessions instead of adding a full auth provider.
- Options considered:
  - NextAuth/Auth.js: good ecosystem, but adds abstraction the reader would spend time unwrapping.
  - Custom signed cookie: smaller surface area, easy to trace, enough for this project.
  - External identity provider integration: realistic in enterprise environments, but too much platform setup for this learning goal.
- Chosen: custom signed cookie session in `src/lib/auth/session.ts`.
- Why chosen: it makes the auth flow explicit from route to cookie without drowning the project in provider setup.
- Junior notice: “login works.”
- Mid-level notice: “the page and API auth paths share one session contract.”
- Senior notice: “session payload size, expiration, and cookie flags are all deliberate security decisions.”

## Stage 4 — Service-layer workflows
- Built: `src/services/leadService.ts`, `src/services/noteService.ts`, `src/services/followUpService.ts`, and `src/services/dashboardService.ts`.
- Decision: modeled lead stage changes as an explicit transition map in `assertValidStageTransition()`.
- Options considered:
  - Free-form stage updates: simplest to code, highest long-term data-quality risk.
  - State-machine library: powerful, but heavy for a six-stage CRUD workflow.
  - Explicit transition map in the service layer: reviewable, testable, and easy to evolve.
- Chosen: explicit transition map in `src/services/leadService.ts`.
- Why chosen: it keeps the rule local, visible, and easy for a reviewer to reason about.
- Junior notice: “there’s a list of allowed moves.”
- Mid-level notice: “the rule belongs in the service layer, not the form.”
- Senior notice: “terminal states and skipped-state reporting quality matter more than implementation cleverness.”

## Stage 5 — Client application and operational screens
- Built: dashboard pages, lead detail pages, React Query hooks, and the App Shell in `src/components/` and `src/hooks/`.
- Decision: one canonical lead detail query feeds editing, notes, follow-ups, and the activity timeline.
- Why: it reduces duplicated fetches and makes invalidation comprehensible.

## Stage 6 — Testing and docs
- Built: targeted tests in `src/tests/` plus the architecture and learning docs under `docs/`.
- Decision: kept the test suite light but purposeful.
- Why: the project is teaching architecture, so the tests focus on policy and workflow failures that matter most in production.

## PR Slices

### Slice 1 — Persistence and domain model
- Purpose in one sentence: define the database contract and stable repository boundary for leads, users, notes, follow-ups, and activity logs.
- Files with novel logic: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`, `src/repositories/leadRepository.ts`, `src/repositories/followUpRepository.ts`
- Reviewer checks:
  - `prisma/schema.prisma`: verify relation names and indexes around `Lead.ownerId`, `Lead.createdById`, and `Lead.nextFollowUpAt`
  - `src/repositories/leadRepository.ts`: verify `buildLeadWhere()` always retains visibility scoping
  - `src/repositories/followUpRepository.ts`: verify the query used for operational follow-up lists is aligned with the dashboard needs
- Junior reviewer would miss: the denormalized `Lead.nextFollowUpAt` field needs active maintenance to stay trustworthy

### Slice 2 — Auth and permission boundary
- Purpose in one sentence: add signed-cookie auth, session helpers, and centralized RBAC.
- Files with novel logic: `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, `src/services/authService.ts`
- Reviewer checks:
  - `src/lib/auth/session.ts`: verify cookie flags, expiration, and payload shape near `createSession()`
  - `src/lib/auth/permissions.ts`: verify reps never gain cross-owner access through helper drift
  - `src/lib/middleware/withAuth.ts`: verify the route handler receives authenticated context only after session verification
- Junior reviewer would miss: page redirects are not the security boundary; route middleware is

### Slice 3 — Lead workflow services and APIs
- Purpose in one sentence: implement lead create/read/update flows with stage transitions, reassignment rules, and audit logging.
- Files with novel logic: `src/services/leadService.ts`, `src/app/api/leads/route.ts`, `src/app/api/leads/[leadId]/route.ts`, `src/repositories/activityRepository.ts`
- Reviewer checks:
  - `src/services/leadService.ts`: inspect `assertValidStageTransition()` and the transaction block around `updateLeadRecord()`
  - `src/app/api/leads/[leadId]/route.ts`: verify `PATCH()` uses the partial schema and not the create schema
  - `src/repositories/activityRepository.ts`: verify activity writes are called from the service layer, not forgotten in the route
- Junior reviewer would miss: “it updates” is not enough; reviewer should ask whether every mutation also preserves the audit trail

### Slice 4 — Notes and follow-up workflows
- Purpose in one sentence: add child-resource workflows that inherit parent authorization and keep parent summaries in sync.
- Files with novel logic: `src/services/noteService.ts`, `src/services/followUpService.ts`, `src/app/api/leads/[leadId]/notes/route.ts`, `src/app/api/follow-ups/[followUpId]/route.ts`
- Reviewer checks:
  - `src/services/noteService.ts`: verify note writes are gated by parent lead access
  - `src/services/followUpService.ts`: verify `syncLeadNextFollowUp()` runs inside the same transaction as status changes
  - `src/app/api/follow-ups/[followUpId]/route.ts`: verify status input is restricted to allowed values
- Junior reviewer would miss: child routes are a common place to accidentally bypass parent security boundaries

### Slice 5 — Dashboard, detail UI, tests, and docs
- Purpose in one sentence: wire the client to the APIs and add learning artifacts that trace the real code paths.
- Files with novel logic: `src/hooks/use-dashboard.ts`, `src/hooks/use-lead-detail.ts`, `src/components/dashboard/dashboard-page.tsx`, `src/components/leads/lead-detail-page.tsx`, `src/tests/*.test.ts`
- Reviewer checks:
  - `src/hooks/use-lead-detail.ts`: verify cache invalidation refreshes both detail and dashboard views after mutations
  - `src/components/dashboard/dashboard-page.tsx`: verify deferred search and filter state stay in the UI layer, not the service layer
  - `src/tests/auth-route-guards.test.ts`: verify the rejection path really exercises route-level authorization
- Junior reviewer would miss: “the UI works” is not enough if the learning docs no longer match the code that shipped
