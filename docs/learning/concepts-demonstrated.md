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

