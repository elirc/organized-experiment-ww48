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

