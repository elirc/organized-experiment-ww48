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

## Layer map with file sizes

Line counts are from the files at the reviewed commit. They show where the weight of the code sits.

| Layer | Files | What lives there |
| --- | --- | --- |
| Route handlers | 9 handlers in 8 files under `src/app/api/` | auth wrapper, body parsing, one service call, error mapping |
| Pages | `src/app/page.tsx`, `src/app/leads/[leadId]/page.tsx`, `src/app/login/page.tsx` | server components that call `requirePageSession()` or `getPageSession()` |
| Auth helpers | `src/lib/auth/session.ts` (87 lines), `permissions.ts` (56), `password.ts` (16) | JWT cookie, role map, bcrypt |
| Middleware | `src/lib/middleware/withAuth.ts` (27), `withRole.ts` (19) | 401 and 403 throwers |
| HTTP helpers | `src/lib/http/request.ts`, `responses.ts`, `api-error.ts`, `client.ts` | body parsing, error-to-JSON mapping, browser fetch wrapper |
| Validation | `src/lib/validation/leadSchemas.ts` (64), `authSchemas.ts` (13) | Zod schemas for every write |
| Services | `leadService.ts` (209), `followUpService.ts` (128), `noteService.ts` (45), `dashboardService.ts` (50), `authService.ts` (36) | all business rules |
| Repositories | `leadRepository.ts` (192), `followUpRepository.ts` (124), `userRepository.ts` (33), `noteRepository.ts` (25), `activityRepository.ts` (19), `shared.ts` (11) | Prisma calls only |
| UI | 12 components, 2 hooks (about 1,540 lines together) | forms, board, timeline |
| Tests | 4 files in `src/tests/`, 1 test each | see `docs/learning/testing-rationale.md` |

There is no `middleware.ts` (Next.js edge middleware) in the repo. Every gate described below runs inside a route handler or a service.

## Route inventory

Every HTTP endpoint in the app. "Awaits `withAuth`" matters a lot; see the next section.

| Method and path | File:line | Auth | Schema | Service call | Awaits `withAuth`? |
| --- | --- | --- | --- | --- | --- |
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts:16` | none (it is the login) | `loginSchema` | `authenticateUser()` then `createSession()` | n/a, all calls awaited |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts:11` | none | none | `destroySession()` | n/a |
| `GET /api/dashboard` | `src/app/api/dashboard/route.ts:17` | `withAuth`, plus `withRole` when `ownerId` is someone else | `leadFilterSchema` (query string) | `getDashboardData()` | yes, `return await` at line 19 |
| `POST /api/leads` | `src/app/api/leads/route.ts:16` | `withAuth` | `createLeadSchema` | `createLeadRecord()` | **no**, line 18 |
| `GET /api/leads/:leadId` | `src/app/api/leads/[leadId]/route.ts:16` | `withAuth` | none | `getLeadDetail()` | **no**, line 18 |
| `PATCH /api/leads/:leadId` | `src/app/api/leads/[leadId]/route.ts:27` | `withAuth` | `updateLeadSchema` | `updateLeadRecord()` | **no**, line 32 |
| `POST /api/leads/:leadId/notes` | `src/app/api/leads/[leadId]/notes/route.ts:16` | `withAuth` | `createNoteSchema` | `addLeadNote()` | **no**, line 21 |
| `POST /api/leads/:leadId/follow-ups` | `src/app/api/leads/[leadId]/follow-ups/route.ts:16` | `withAuth` | `createFollowUpSchema` | `addLeadFollowUp()` | **no**, line 21 |
| `PATCH /api/follow-ups/:followUpId` | `src/app/api/follow-ups/[followUpId]/route.ts:16` | `withAuth` | `updateFollowUpStatusSchema` | `changeFollowUpStatus()` | **no**, line 21 |

There is no list endpoint for leads. The dashboard route is the only way to list them. `getLeadList()` in `src/services/leadService.ts:50-52` exists but nothing calls it.

There are no delete endpoints. Leads, notes, follow-ups and activity rows can only be removed by the seed script (`prisma/seed.ts:109-112`) or by hand in the database.

## The error contract, and where it breaks

The intended contract is simple. Services and middleware throw `ApiError(message, statusCode, code)` (`src/lib/http/api-error.ts:9-19`). Zod throws `ZodError`. Every route wraps its body in `try { ... } catch (error) { return toErrorResponse(error); }`. `toErrorResponse()` (`src/lib/http/responses.ts:25-59`) maps:

| Thrown value | Response |
| --- | --- |
| `ZodError` | 400, `{ error: "Validation failed.", code: "VALIDATION_ERROR", issues }` (lines 26-35) |
| `ApiError` | its own status, `{ error, code, details }` (lines 37-46) |
| anything else | logs it, then 500 `{ error: "Internal server error.", code: "INTERNAL_SERVER_ERROR" }` (lines 50-58) |

**Correction:** the contract only holds for three of the nine handlers: login, logout and dashboard. In the other six, the `try` block does `return withAuth(request, handler)` with no `await`. `withAuth` is an `async` function, so it returns a promise. Returning a promise from inside `try` in an async function does not let the `catch` see that promise's rejection. Every `ApiError` and `ZodError` thrown inside those handlers therefore escapes the route, and Next.js answers with a generic 500. This is standard JavaScript `async` semantics, read from the code, not observed in a running server. The fix is one word per handler: `return await withAuth(...)`, the same as `src/app/api/dashboard/route.ts:19`.

A second, smaller gap: `parseJsonBody()` calls `request.json()` (`src/lib/http/request.ts:14`). Malformed JSON throws a `SyntaxError`, which is neither a `ZodError` nor an `ApiError`, so even on a correctly awaited route it becomes a 500. On the login route, for example, body `{not json` falls through to the last branch of `toErrorResponse()` and becomes 500 `INTERNAL_SERVER_ERROR` (`src/lib/http/responses.ts:50-58`).

## Cross-cutting facts worth knowing early

- **Configuration fails at import time.** `src/lib/env.ts:15-21` calls `envSchema.parse()` at module load. Any file that imports `env` (today only `src/lib/auth/session.ts:5`) will throw on import if `DATABASE_URL` or `SESSION_SECRET` is missing or too short. `src/lib/db.ts` does not import `env`; Prisma reads `DATABASE_URL` itself.
- **One Prisma client per process.** `src/lib/db.ts:14-22` caches the client on `globalThis` outside production to survive hot reload. It logs every query in development (line 17).
- **Repositories accept a client or a transaction.** `DatabaseClient = PrismaClient | Prisma.TransactionClient` (`src/repositories/shared.ts:11`). That is why services can pass `transaction` into the same repository functions inside `db.$transaction()`.
- **Authorization reads happen outside the transactions.** Every service loads the row it is about to check (`findLeadById`, `findFollowUpById`) with the plain `db` client, runs the checks, and only then opens `db.$transaction()`. The transaction makes the write and its activity log atomic. It does not protect the check. This is the root of the race findings in `docs/learning/flow-traces.md`.
- **The lead detail query is heavy and is also used for permission checks.** `findLeadById()` (`src/repositories/leadRepository.ts:97-162`) includes owner, creator, every note with author, every follow-up with owner and creator, and every activity row with actor. `addLeadNote()`, `addLeadFollowUp()` and `updateLeadRecord()` call it only to read `ownerId` and `stage`. On a lead with a long history, every write pays for the full tree.
- **No pagination anywhere.** `listLeads()` (`src/repositories/leadRepository.ts:71-81`) and `findLeadById()` have no `take`. Only `listUpcomingFollowUps()` caps at 8 (`src/repositories/followUpRepository.ts:41`).

## Where to go next

- Security model and the route gate table: [`auth-and-permissions.md`](auth-and-permissions.md)
- Entities, indexes and state machines: [`domain-model.md`](domain-model.md)
- Request walkthroughs, including error paths: [`request-lifecycle.md`](request-lifecycle.md)
- Reading order with exercises: [`../learning/guided-reading-path.md`](../learning/guided-reading-path.md)
