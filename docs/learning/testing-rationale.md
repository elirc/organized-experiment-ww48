# Testing Rationale

## `rejects a rep trying to filter another owner's leads with 403` — `src/tests/auth-route-guards.test.ts`
This behavior matters because query parameters often look harmless, and they are a classic place for access-control regressions. If `src/app/api/dashboard/route.ts` stopped calling `withRole()` before building the dashboard read model, a rep could enumerate other owners’ pipeline data without ever touching the UI.

A fuller production suite would add route-level tests for unauthenticated access, manager/admin success paths, and direct lead-detail read/write rejections.

## `rejects an invalid lead payload before service logic runs` — `src/tests/validation-schemas.test.ts`
This matters because malformed payloads should fail at the boundary in `src/lib/validation/leadSchemas.ts`, not after service logic has already begun reasoning about owners, stages, and activity logs. In production, boundary validation bugs often show up as partial writes, noisy incident logs, or "impossible" rows that everyone blames on the database.

A fuller production suite would add route tests asserting the exact 400 response body and more schema coverage for note and follow-up payloads.

## `rejects a skipped transition from NEW directly to WON` — `src/tests/lead-stage-transition.test.ts`
This matters because lead stage transitions are a forecasting rule, not just a dropdown value. If `assertValidStageTransition()` in `src/services/leadService.ts` were loosened by accident, reporting quality and audit trail trust would both degrade quietly.

A fuller production suite would test every allowed transition, terminal-state behavior, and the exact activity log written after a legal transition.

## `keeps the owner scope in the repository where-clause for rep visibility` — `src/tests/ownership-isolation.test.ts`
This matters because the repository layer is where service intent finally becomes a database query. `buildLeadWhere()` in `src/repositories/leadRepository.ts` must preserve ownership scope even when search and stage filters are added, or one refactor can turn into a cross-owner data leak.

A fuller production suite would run integration tests against a real test database to prove that user A never receives user B’s rows, even through list endpoints with mixed filters and sort orders.

## Does `npm test` run these tests?

Yes, with two conditions. By reading:

- `npm test` runs `vitest` (`package.json:10`). In an interactive terminal that starts watch mode and never exits. Use `npm run test:run` (`vitest run`, line 11) for a single pass, or set `CI=true`.
- `vitest.config.ts:9` includes `src/tests/**/*.test.ts`. All four files match. There are no other test files in the repo.
- The environment is `jsdom` (`vitest.config.ts:6`), and `vitest.setup.ts:3-6` fills in `DATABASE_URL` and `SESSION_SECRET` defaults, so `src/lib/env.ts` does not throw on import.
- The `@` alias resolves to `src/` (`vitest.config.ts:11-15`).

Condition 1: **`prisma generate` must have run.** Two of the four tests import code that constructs a `PrismaClient` at module load:

| Test file | Import chain | Needs generated client? |
| --- | --- | --- |
| `auth-route-guards.test.ts` | dashboard route → `dashboardService` → `src/lib/db.ts:14-18` (`new PrismaClient(...)`) | yes |
| `lead-stage-transition.test.ts` | `leadService` → `src/lib/db.ts` | yes |
| `ownership-isolation.test.ts` | `leadRepository` → `import { Prisma } from "@prisma/client"` (value import, not used at runtime) | import must resolve; no client is constructed |
| `validation-schemas.test.ts` | `leadSchemas` → `zod` only | no |

Constructing the client does not open a connection, so no database is needed. But on a fresh clone without `prisma generate`, the first two files fail to load.

Condition 2: **nothing here needs a running Postgres.** No test touches the database. That also means no test exercises a query, a transaction, or a race.

## What each test proves and does not prove

| Test | Proves | Does not prove |
| --- | --- | --- |
| `auth-route-guards` | The dashboard route maps a `withRole` rejection to HTTP 403 with `code: "FORBIDDEN"` for a rep asking for another `ownerId`. | Anything about real sessions: `withAuth` is replaced by a `vi.doMock` stub (lines 9-19), so the cookie, JWT and 401 path never run. Anything about the other six routes, which handle errors differently (they would return 500; see [`../architecture/request-lifecycle.md`](../architecture/request-lifecycle.md)). Manager and admin success paths. |
| `validation-schemas` | `createLeadSchema` rejects a payload with a 1-char company name, a bad email and an empty `ownerId`. | Which field failed (the test only checks that some `ZodError` was thrown). The update schema at all, which is where the real bug is (`stage` default, see below). Note and follow-up schemas. The HTTP 400 mapping. |
| `lead-stage-transition` | `NEW -> WON` throws with the expected message. | The other 35 pairs. Terminal states. The status code (409). That the check is ever reached with the right input; the `PATCH` path feeds it an injected `stage: "NEW"`. Concurrency. |
| `ownership-isolation` | `buildLeadWhere()` keeps `{ ownerId }` in the `AND` list next to stage and search filters. | That the dashboard service passes the rep's scope (it does, `dashboardService.ts:16-18`, but no test checks it). Anything about `GET /api/leads/:id`, which does not use `buildLeadWhere()`. Follow-up lists, which have their own scope (`followUpRepository.ts:21`). |

The suite has one test per file. All four are worth keeping. None of them would catch any of the findings listed in the docs.

## How the claims in these docs were checked

This review did not install dependencies, so `vitest` was not run, and no other code was executed either. Every behavior described in these docs comes from reading the cited lines. Where a claim depends on library semantics, the docs say which ones:

| Claim | Depends on | Cheapest confirmation |
| --- | --- | --- |
| Six routes return 500 instead of their mapped status | JavaScript `async` rules for `return` inside `try` | `curl -i /api/leads/<id>` with no cookie against a running dev server |
| A PATCH without `stage` becomes "move to NEW" | Zod 4 applying `.default()` inside `.optional()` / `.partial()` | `expect(updateLeadSchema.parse({ companyName: "Acme Co" })).not.toHaveProperty("stage")` in the existing jsdom suite; it should fail today |
| Concurrent follow-up status changes both succeed | Postgres READ COMMITTED and an unconditional `update({ where: { id } })` | Two `fetch` calls to `PATCH /api/follow-ups/<id>` with `Promise.all` |
| A follow-up `dueAt` shifts with the server zone | JavaScript parsing of a date-time string without an offset | Start the server with `TZ=UTC` and again with another zone, create the same follow-up, compare `dueAt` |
| Malformed JSON gives 500 | `request.json()` throwing `SyntaxError`, which `toErrorResponse()` does not map | `curl -X POST /api/auth/login -d '{not json'` |


## Tests worth adding, tied to findings

Each of these would fail on the current code and pass after the fix.

| Test | Asserts | Finding |
| --- | --- | --- |
| `GET /api/leads/:id` without a cookie returns 401 | `response.status === 401` (call the real route, no `withAuth` mock) | missing `await` (request-lifecycle, A1) |
| `GET /api/leads/:id` as a rep on another rep's lead returns 403 JSON | status and `code: "LEAD_ACCESS_DENIED"` | A1 |
| `POST /api/leads` with an invalid body returns 400 | status and `code: "VALIDATION_ERROR"` | A1 |
| any route with a non-JSON body returns 400 | status | `SyntaxError` not mapped (`responses.ts:25-59`) |
| `updateLeadSchema.parse({ companyName: "Acme Co" })` has no `stage` key | `"stage" in result === false` | stage default (domain-model) |
| `updateLeadSchema.parse({})` throws | the "At least one field" issue | stage default |
| `createLeadSchema` rejects `stage: "WON"` | `ZodError` (or service 409) | A7 |
| two concurrent `changeFollowUpStatus` calls: exactly one succeeds | one fulfilled, one 409; one log row | follow-up race |
| two concurrent stage changes from `NEGOTIATION`: exactly one succeeds | one fulfilled, one 409 | stage race |
| lead owner can cancel a follow-up on their lead assigned to someone else (or the opposite, once the rule is decided) | service result | A4 |
| `hasPermission(user, "createLead")` is consulted by `createLeadRecord` | a role with `createLead: false` gets 403 | A6 |
| inactive user with a valid cookie gets 401 | status | A5 |

The race tests need a real Postgres to be meaningful. A small integration setup with the `docker-compose.yml` database and `prisma db push` before the run is enough. The unit-level ones (schemas, permission helpers, transition map) can stay in the current jsdom suite.
