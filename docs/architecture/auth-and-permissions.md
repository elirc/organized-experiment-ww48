# Auth And Permissions

Authentication flow:

- Credentials are parsed in `src/app/api/auth/login/route.ts` with `loginSchema` from `src/lib/validation/authSchemas.ts`.
- `authenticateUser()` in `src/services/authService.ts` loads the user through `findUserByEmail()` in `src/repositories/userRepository.ts`, checks `isActive`, and verifies the bcrypt hash through `verifyPassword()` in `src/lib/auth/password.ts`.
- `createSession()` in `src/lib/auth/session.ts` signs the cookie payload and writes the `crm_session` HTTP-only cookie.
- Server-rendered pages call `requirePageSession()` in `src/lib/auth/session.ts` before they render `src/app/page.tsx` or `src/app/leads/[leadId]/page.tsx`.
- API routes call `withAuth()` in `src/lib/middleware/withAuth.ts`, which reads the session with `getRequestSession()` from `src/lib/auth/session.ts` and rejects unauthenticated requests with a 401 `ApiError`.

Role model:

- Roles live in `prisma/schema.prisma` as `enum UserRole` with `ADMIN`, `MANAGER`, and `REP`.
- Role capabilities are centralized in `src/lib/auth/permissions.ts` inside `rolePermissions`.
- `hasPermission()` is the base capability check, while `canAccessLead()`, `canEditLead()`, `canReassignLead()`, and `canManageFollowUp()` convert role data into lead-specific authorization rules.
- `withRole()` in `src/lib/middleware/withRole.ts` rejects elevated-only actions with a 403 before business logic runs. One concrete use is `src/app/api/dashboard/route.ts`, where a rep trying to query `ownerId` for another user is rejected before `getDashboardData()` executes.

Ownership and data isolation:

- Lead visibility is computed in `src/services/dashboardService.ts` and `src/services/leadService.ts` by `getLeadVisibility()`. For reps, it returns `{ ownerId: user.id }`; for managers and admins, it returns `{}`.
- The repository scoping happens in `src/repositories/leadRepository.ts` inside `buildLeadWhere()`. When `visibility.ownerId` is present, the query adds `{ ownerId: visibility.ownerId }` to the Prisma `AND` list.
- The current app is not multi-tenant. Isolation is owner-based and role-based, not tenant-based. To add multi-tenancy later, `tenantId` would need to be added to `prisma/schema.prisma`, injected into the session shape in `src/lib/types/auth.ts`, applied inside `buildLeadWhere()` in `src/repositories/leadRepository.ts`, and mirrored in follow-up and note repositories. The service boundaries already pass explicit visibility objects, so this is additive rather than a rewrite.

Concrete permission examples:

- A rep can view only owned leads because `getLeadDetail()` in `src/services/leadService.ts` calls `canAccessLead(user, lead.ownerId)` after loading the lead through `findLeadById()`.
- A rep cannot reassign a lead because `updateLeadRecord()` in `src/services/leadService.ts` checks `canReassignLead(user)` before accepting `ownerId` changes.
- A rep cannot assign follow-ups to teammates because `addLeadFollowUp()` in `src/services/followUpService.ts` compares `input.ownerId` to `user.id` and rejects cross-user assignment unless `canReassignLead(user)` is true.
- A manager or admin can filter another owner’s dashboard data only because `src/app/api/dashboard/route.ts` calls `withRole(user, ["ADMIN", "MANAGER"])` when the requested `ownerId` differs from the caller.

