# Architecture Overview

This project is a single-tenant CRM lead pipeline built around explicit backend boundaries. Requests enter through `src/app/api/**/route.ts`, pass through auth and validation helpers in `src/lib/`, execute business rules in `src/services/`, and hit Prisma-backed repositories in `src/repositories/`.

Top-level folders and how they relate:

- `src/app/` contains App Router pages and REST endpoints. For example, `src/app/api/leads/[leadId]/route.ts` turns HTTP input into `getLeadDetail()` or `updateLeadRecord()` service calls, while `src/app/leads/[leadId]/page.tsx` renders the authenticated lead workspace.
- `src/components/` contains client-facing UI composition. `src/components/dashboard/dashboard-page.tsx` coordinates the dashboard query and passes data into presentation-focused children like `src/components/dashboard/pipeline-board.tsx`.
- `src/hooks/` contains React Query hooks that speak HTTP, not business logic. `src/hooks/use-lead-detail.ts` owns the client cache and mutation invalidation strategy for `/api/leads/[leadId]`.
- `src/lib/` contains cross-cutting concerns. `src/lib/auth/session.ts` signs and verifies cookies, `src/lib/middleware/withAuth.ts` enforces authentication for routes, and `src/lib/validation/leadSchemas.ts` defines the Zod input boundary.
- `src/services/` owns workflow rules. `src/services/leadService.ts` decides whether a stage transition is legal, whether a rep can reassign a lead, and which activity logs must be written.
- `src/repositories/` owns Prisma query shapes. `src/repositories/leadRepository.ts` builds lead filters, keeps include trees consistent, and scopes lead reads via the `LeadVisibilityScope`.
- `prisma/` contains the database contract. `prisma/schema.prisma` defines users, leads, notes, follow-ups, and activity logs, while `prisma/seed.ts` provisions demo credentials and sample pipeline data.
- `docs/architecture/` explains how requests and layers fit together.
- `docs/learning/` is the code-reading guide anchored to specific files and functions in this repo.

Why this layout matters:

- The UI never decides authorization. `src/components/` sends requests, but `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, and the service-layer permission checks remain the actual security boundary.
- Validation happens before service logic. Route files call `parseJsonBody()` from `src/lib/http/request.ts` with schemas from `src/lib/validation/`.
- Repository code is shaped so multi-tenancy can be added later by extending the `visibility` constraint in `src/repositories/leadRepository.ts` instead of rewriting every component or route.

