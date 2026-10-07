# Concepts Demonstrated

## Service layer
Where to look: `src/services/leadService.ts` — `updateLeadRecord()` owns workflow rules instead of the route or component.
Also see: `src/services/followUpService.ts` for a second service that coordinates child and parent writes.
Risk if wrong: Business rules drift across handlers and become impossible to audit.

## Repository pattern
Where to look: `src/repositories/leadRepository.ts` — `buildLeadWhere()`, `listLeads()`, and `findLeadById()` convert service inputs into stable Prisma queries.
Also see: `src/repositories/followUpRepository.ts` for a repository focused on operational child records.
Risk if wrong: Query shapes become duplicated, inconsistent, and prone to data leaks.

## Zod validation boundary
Where to look: `src/lib/validation/leadSchemas.ts` — `createLeadSchema`, `updateLeadSchema`, `createNoteSchema`, and `updateFollowUpStatusSchema`.
Also see: `src/lib/http/request.ts` for how route files call the schemas.
Risk if wrong: Invalid payloads reach service code and create partial or misleading state.

## Auth/session flow
Where to look: `src/lib/auth/session.ts` — `createSession()`, `getRequestSession()`, and `requirePageSession()`.
Also see: `src/app/api/auth/login/route.ts` for where the cookie is issued.
Risk if wrong: Pages and APIs stop agreeing on who is authenticated.

## Role-based access control
Where to look: `src/lib/auth/permissions.ts` — `rolePermissions`, `canAccessLead()`, and `canReassignLead()`.
Also see: `src/lib/middleware/withRole.ts` for elevated-only route checks.
Risk if wrong: Reps can gain manager-like access or managers lose required operational capabilities.

## Status or state transitions
Where to look: `src/services/leadService.ts` — `assertValidStageTransition()` restricts legal lead movement.
Also see: `src/services/followUpService.ts` — `changeFollowUpStatus()` blocks non-pending transitions.
Risk if wrong: Forecasting and timeline trust both collapse because the system accepts impossible workflow jumps.

## Audit logging
Where to look: `src/repositories/activityRepository.ts` — `createActivityLog()` is called from `src/services/leadService.ts`, `src/services/noteService.ts`, and `src/services/followUpService.ts`.
Also see: `src/components/leads/activity-timeline.tsx` for how the audit trail surfaces in the UI.
Risk if wrong: Operational debugging and user accountability become much harder.

## Ownership-based data isolation
Where to look: `src/services/dashboardService.ts` — `getLeadVisibility()` and `getAssignableUsersForViewer()`.
Also see: `src/repositories/leadRepository.ts` — `buildLeadWhere()` applies the ownership scope to the actual Prisma query.
Risk if wrong: Users can see or infer another owner’s pipeline and assignment metadata.

## Transaction boundaries
Where to look: `src/services/leadService.ts` — `createLeadRecord()` and `updateLeadRecord()` use `db.$transaction()`.
Also see: `src/services/followUpService.ts` — `changeFollowUpStatus()` updates both the follow-up and the parent lead summary in one transaction.
Risk if wrong: Primary rows and activity logs drift apart after partial failures.

## Denormalized read model maintenance
Where to look: `src/services/followUpService.ts` — `syncLeadNextFollowUp()` recomputes `Lead.nextFollowUpAt`.
Also see: `prisma/schema.prisma` — `Lead.nextFollowUpAt` exists to support fast dashboard sorting.
Risk if wrong: The dashboard sorts by stale operational data.

## React Query request/cache boundary
Where to look: `src/hooks/use-lead-detail.ts` — mutations invalidate `["lead-detail", leadId]` and `["dashboard"]`.
Also see: `src/hooks/use-dashboard.ts` for dashboard filter queries and create-lead invalidation.
Risk if wrong: The UI shows stale pipeline state after successful writes.

## Multi-tenancy readiness
Where to look: `src/repositories/leadRepository.ts` — `LeadVisibilityScope` is already an explicit query input.
Also see: `docs/architecture/auth-and-permissions.md` for the concrete files that would need `tenantId`.
Risk if wrong: A later tenant migration becomes a cross-cutting rewrite instead of a scoped repository/service change.

## Where each concept is incomplete

Every concept above is really in the code. This section records, for the same concepts in the same order, where the implementation stops short. Use it as a list of review questions: each one is something a senior reviewer would raise on this codebase. Every item comes from reading the cited lines.

### Service layer
The rules live in services, as claimed. But the service functions check a row they read outside their own transaction (`leadService.ts:125` then `:151`; `followUpService.ts:86` then `:102`). A service layer that owns the rules also has to own the moment the rule is checked. Here, two requests can both pass the same rule.

### Repository pattern
The repositories are thin and consistent. Two gaps: `findLeadById()` is used both as the detail read model and as a permission lookup, so every note or follow-up write loads the whole lead tree just to read `ownerId` (`leadRepository.ts:97-162`; `noteService.ts:17`, `followUpService.ts:35`, `leadService.ts:125`). And `updateLead()` / `updateFollowUpStatus()` write with `where: { id }` only, which is what makes the races possible (`leadRepository.ts:177`, `followUpRepository.ts:109`). A repository that offered `updateIfStage(id, expected, data)` would make the safe write the easy one.

### Zod validation boundary
Every write goes through a schema, as claimed. But a schema can add data as well as reject it. `updateLeadSchema` inherits `stage: default("NEW")` from the create schema (`leadSchemas.ts:34`, `:39`), so a PATCH without `stage` reaches the service as "move to NEW". And the boundary only becomes a clean 400 on routes that `await` their handler; on six routes a `ZodError` becomes a 500.

### Auth/session flow
Pages and APIs agree on who is authenticated, as claimed. They do not re-check whether that user still exists or is active; the JWT carries the identity and role for 7 days (`session.ts:22-28`, `authService.ts:18`). Logout clears the cookie but not the token (`session.ts:58-61`).

### Role-based access control
Capabilities are centralized in one map. One of the five capabilities, `createLead`, is never checked (`permissions.ts:13`, `:20`, `:27`; no caller). And `withRole()` uses role names rather than the map (`withRole.ts:11-12`), so there are two sources of truth that agree only because `ADMIN` and `MANAGER` are identical today.

### Status or state transitions
The transition map is explicit and correct as a table (exactly 8 legal moves in `leadService.ts:23-30`). It is not applied at creation (a lead can be created as `WON`). It is fed a fake target on PATCH requests that omit `stage`. And it is not atomic with the write. The follow-up machine has the same atomicity gap.

### Audit logging
Every mutation writes a log row in the same transaction, as claimed. The log describes what was requested, not what changed: `DETAILS_UPDATED` is written whenever a key is present (`leadService.ts:194-196`), so every UI save logs it. Under concurrency the log records both of two contradictory changes. And `metadata` is written but never shown; `activity-timeline.tsx` renders only `message`, `type`, actor and time (lines 25-34).

### Ownership-based data isolation
List isolation is solid: `buildLeadWhere()` always adds the rep's scope (`leadRepository.ts:43-49`), and the shipped test checks it. Single-record isolation is solid too. The gap is the child resource with its own owner: follow-ups. A follow-up's owner may not own its lead, and the rules for seeing and changing it follow the follow-up, not the lead (`followUpRepository.ts:21`, `followUpService.ts:92`).

### Transaction boundaries
The transactions group a write with its audit row, as claimed. They do not include the reads the decision was based on. That is the general lesson of this codebase: a transaction gives atomicity of the writes inside it, not correctness of a check made before it began.

### Denormalized read model maintenance
`syncLeadNextFollowUp()` recomputes the summary after every create and status change. Under concurrent creates on one lead it can store a later date than the true minimum, because each transaction computes the minimum without seeing the other's uncommitted row (by reading; see the third race trace in [`flow-traces.md`](flow-traces.md)). Lead reassignment does not touch follow-ups at all.

### React Query request/cache boundary
Invalidation after writes is correct and consistent (`use-lead-detail.ts:87-90`). The mutation buttons for follow-up status have no pending state, so the cache layer does not prevent double submits, and the error message the UI shows for most failures is the generic "Request failed." because the 4xx JSON never arrives (`client.ts:17-23`).

### Multi-tenancy readiness
The visibility object is a real insertion point for lists. It is not one for single-record reads: `findLeadById()`, `findFollowUpById()` and `findUserById()` take only an id. Adding tenants would mean changing those signatures, or adding a tenant check next to every `canAccessLead()` call. Still additive, but wider than "extend `buildLeadWhere()`".

## Concepts present in the code but not listed above

| Concept | Where | Note |
| --- | --- | --- |
| Account-enumeration-safe login | `authService.ts:18-28` | same message and code for unknown user, inactive user and wrong password |
| Fail-fast configuration | `src/lib/env.ts:10-21` | Zod-validated at import |
| Prisma client singleton for hot reload | `src/lib/db.ts:10-22` | cached on `globalThis` outside production |
| Transaction-capable repository signature | `src/repositories/shared.ts:11` | `PrismaClient \| Prisma.TransactionClient` |
| Shared enum constants for client and server | `src/lib/domain.ts:9-29` | keeps form options and Zod enums in sync without importing Prisma in the browser |
| Least-data responses for assignment lists | `dashboardService.ts:20-30`, `src/app/leads/[leadId]/page.tsx:19-23` | reps get only themselves; the page strips email before passing users to the client |

