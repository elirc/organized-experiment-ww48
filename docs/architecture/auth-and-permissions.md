# Auth And Permissions

Authentication flow:

- Credentials are parsed in `src/app/api/auth/login/route.ts` with `loginSchema` from `src/lib/validation/authSchemas.ts`.
- `authenticateUser()` in `src/services/authService.ts` loads the user through `findUserByEmail()` in `src/repositories/userRepository.ts`, checks `isActive`, and verifies the bcrypt hash through `verifyPassword()` in `src/lib/auth/password.ts`.
- `createSession()` in `src/lib/auth/session.ts` signs the cookie payload and writes the `crm_session` HTTP-only cookie.
- Server-rendered pages call `requirePageSession()` in `src/lib/auth/session.ts` before they render `src/app/page.tsx` or `src/app/leads/[leadId]/page.tsx`.
- API routes call `withAuth()` in `src/lib/middleware/withAuth.ts`, which reads the session with `getRequestSession()` from `src/lib/auth/session.ts` and rejects unauthenticated requests with a 401 `ApiError`.

**Correction (last bullet):** `withAuth()` does throw a 401 `ApiError` (`src/lib/middleware/withAuth.ts:20-24`). But the client only receives a 401 from `GET /api/dashboard`. The other six authenticated handlers do not `await` `withAuth`, so the error skips their `catch` and Next.js returns a 500. See "Inside the auth wrapper" below and finding A1.

Role model:

- Roles live in `prisma/schema.prisma` as `enum UserRole` with `ADMIN`, `MANAGER`, and `REP`.
- Role capabilities are centralized in `src/lib/auth/permissions.ts` inside `rolePermissions`.
- `hasPermission()` is the base capability check, while `canAccessLead()`, `canEditLead()`, `canReassignLead()`, and `canManageFollowUp()` convert role data into lead-specific authorization rules.
- `withRole()` in `src/lib/middleware/withRole.ts` rejects elevated-only actions with a 403 before business logic runs. One concrete use is `src/app/api/dashboard/route.ts`, where a rep trying to query `ownerId` for another user is rejected before `getDashboardData()` executes.

**Clarification:** the dashboard is not just "one concrete use"; it is the only call to `withRole()` in the codebase (`src/app/api/dashboard/route.ts:25`). Every other role decision goes through `permissions.ts` helpers inside services. Also note that `withRole()` takes a list of role names, not a permission name, so it does not read `rolePermissions` at all. The two systems agree today only because `ADMIN` and `MANAGER` have identical permissions.

Ownership and data isolation:

- Lead visibility is computed in `src/services/dashboardService.ts` and `src/services/leadService.ts` by `getLeadVisibility()`. For reps, it returns `{ ownerId: user.id }`; for managers and admins, it returns `{}`.
- The repository scoping happens in `src/repositories/leadRepository.ts` inside `buildLeadWhere()`. When `visibility.ownerId` is present, the query adds `{ ownerId: visibility.ownerId }` to the Prisma `AND` list.
- The current app is not multi-tenant. Isolation is owner-based and role-based, not tenant-based. To add multi-tenancy later, `tenantId` would need to be added to `prisma/schema.prisma`, injected into the session shape in `src/lib/types/auth.ts`, applied inside `buildLeadWhere()` in `src/repositories/leadRepository.ts`, and mirrored in follow-up and note repositories. The service boundaries already pass explicit visibility objects, so this is additive rather than a rewrite.

**Clarification:** there are two identical `getLeadVisibility()` functions (`src/services/dashboardService.ts:16-18` and `src/services/leadService.ts:32-34`). The one in `leadService.ts` is only used by `getLeadList()`, which nothing calls. In practice, list visibility is decided only in `dashboardService.ts`. Single-record visibility (`GET /api/leads/:id`) does not use `buildLeadWhere()` at all; it loads the row by id and then checks `canAccessLead()` in the service. Both paths have to stay correct for isolation to hold.

Concrete permission examples:

- A rep can view only owned leads because `getLeadDetail()` in `src/services/leadService.ts` calls `canAccessLead(user, lead.ownerId)` after loading the lead through `findLeadById()`.
- A rep cannot reassign a lead because `updateLeadRecord()` in `src/services/leadService.ts` checks `canReassignLead(user)` before accepting `ownerId` changes.
- A rep cannot assign follow-ups to teammates because `addLeadFollowUp()` in `src/services/followUpService.ts` compares `input.ownerId` to `user.id` and rejects cross-user assignment unless `canReassignLead(user)` is true.
- A manager or admin can filter another owner’s dashboard data only because `src/app/api/dashboard/route.ts` calls `withRole(user, ["ADMIN", "MANAGER"])` when the requested `ownerId` differs from the caller.

All four examples are correct at the service level. On every route except the dashboard, the HTTP status the client sees is 500 rather than 403 (finding A1).

## The session, step by step

The session is a signed JWT in one cookie. There is no session table.

| Step | Code | What happens |
| --- | --- | --- |
| Sign | `src/lib/auth/session.ts:22-28` | `new SignJWT(user)` with `alg: HS256`, `iat`, and `exp` 7 days out. The payload is the whole `SessionUser`: `id`, `email`, `name`, `role` (`src/lib/types/auth.ts:13-18`). |
| Key | `session.ts:18-20` | `SESSION_SECRET` from `src/lib/env.ts`, at least 32 characters (`env.ts:12`). |
| Write cookie | `session.ts:43-56` | Name `crm_session` (line 15). `httpOnly: true`, `sameSite: "lax"`, `secure` only in production, `path: "/"`, `maxAge` 7 days (line 54). |
| Read in pages | `session.ts:63-66`, `68-76` | `getPageSession()` uses `next/headers` cookies. `requirePageSession()` redirects to `/login` if the token is missing or invalid. |
| Read in API | `session.ts:78-87` | `getRequestSession()` parses the raw `cookie` header by hand: split on `;`, find the entry that starts with `crm_session=`, take the part after the first `=`. JWTs are base64url with no `=` padding, so that split is safe for this token. |
| Verify | `session.ts:30-41` | `jwtVerify()`; any failure (bad signature, expired, malformed) returns `null`, never throws. |
| Logout | `session.ts:58-61` | Deletes the cookie in the browser. The token itself stays valid until `exp`. |

Things the session does not do (all by reading):

- It never re-reads the user. `isActive` is checked once, at login (`src/services/authService.ts:18`). A deactivated user keeps a working cookie for up to 7 days.
- Role is frozen in the token. Demoting a manager to rep in the database does not change what `hasPermission()` sees until they log in again, because `hasPermission()` reads `user.role` from the token (`src/lib/auth/permissions.ts:36-38`).
- There is no server-side revocation list. A stolen cookie works until it expires, even after the victim logs out.
- There is no CSRF token. The defence is `sameSite: "lax"` (line 51), which blocks cross-site `POST` and `PATCH` with cookies in current browsers. All writes in this app are `POST` or `PATCH`, so that is a reasonable baseline. No `GET` handler changes state.

### Headerless-identity check

A common defect in this family of projects is an identity resolver that falls back to a privileged user when no cookie or header is present. That defect is **not** present here. `verifySessionToken(undefined)` returns `null` (`session.ts:31-33`), `withAuth()` throws on `null` (`withAuth.ts:20-24`), and `requirePageSession()` redirects (`session.ts:71-73`). Because `withAuth()` throws before calling `handler` (line 23 comes before line 26), no handler body reaches a service without a valid cookie, whether or not the route awaits it.

## Inside the auth wrapper

`withAuth()` is 13 lines (`src/lib/middleware/withAuth.ts:14-27`):

1. `getRequestSession(request)` returns a `SessionUser` or `null` (line 18).
2. If `null`, throw `new ApiError("You must be logged in to access this resource.", 401, "UNAUTHORIZED")` (line 23).
3. Otherwise `return handler({ user })` (line 26).

Note what this means for errors. The wrapper itself never catches anything. It returns the handler's promise. Whoever calls `withAuth` must `await` it inside a `try` for any thrown error to be mapped. Here is what each route does with that promise, and the status a client actually receives. Every cell is read from the code; nothing here was executed.

| Situation | Dashboard (`return await`) | The other six (`return withAuth(...)`) |
| --- | --- | --- |
| No cookie | 401 `UNAUTHORIZED` | promise rejects with `ApiError 401`; Next.js turns an uncaught handler error into 500 |
| Rep asks for another rep's lead | n/a | rejects with `ApiError 403` |
| Lead id does not exist | n/a | rejects with `ApiError 404` |
| Body fails Zod | 400 `VALIDATION_ERROR` if the query string fails | rejects with `ZodError` |
| Body is not JSON | n/a (no body) | rejects with `SyntaxError` |
| Rep filters by another owner | 403 `FORBIDDEN` | n/a |

The browser side makes this worse in a quiet way. `apiFetch()` reads `error` from the JSON body of a failed response (`src/lib/http/client.ts:17-23`). A Next.js 500 for an uncaught error is not this app's JSON shape, so the UI shows the fallback text "Request failed." instead of "You cannot edit this lead." The security outcome is still correct (nothing was written), but the status code and the message are wrong.

## Route-by-route gate table

One row per handler. "Service check" is the authorization that runs after `withAuth`. File:line references point at the check itself.

| Route | Who passes `withAuth` | Service-level check | File:line | Denial code (thrown) |
| --- | --- | --- | --- | --- |
| `POST /api/auth/login` | everyone | `isActive` and bcrypt compare | `authService.ts:18`, `:24-28` | 401 `INVALID_CREDENTIALS`, same message for both cases |
| `POST /api/auth/logout` | everyone | none | `logout/route.ts:11-18` | none |
| `GET /api/dashboard` | any session | `withRole(ADMIN, MANAGER)` only when `ownerId` is set and is not the caller | `dashboard/route.ts:22-26` | 403 `FORBIDDEN` |
| | | rep list scope `{ ownerId: user.id }` | `dashboardService.ts:16-18`, `leadRepository.ts:43-49` | none, rows are filtered |
| | | assignable users trimmed to self for reps | `dashboardService.ts:20-30` | none |
| `POST /api/leads` | any session | caller must be the owner unless `canReassignLead` | `leadService.ts:82-84` | 403 `OWNER_ASSIGNMENT_DENIED` |
| | | owner must exist and be active | `leadService.ts:86-90` | 400 `INVALID_OWNER` |
| `GET /api/leads/:id` | any session | `canAccessLead(user, lead.ownerId)` | `leadService.ts:61-63` | 404 `LEAD_NOT_FOUND`, 403 `LEAD_ACCESS_DENIED` |
| `PATCH /api/leads/:id` | any session | `canEditLead(user, lead.ownerId)` | `leadService.ts:131-133` | 403 `LEAD_EDIT_DENIED` |
| | | owner change needs `canReassignLead` | `leadService.ts:135-137` | 403 `OWNER_ASSIGNMENT_DENIED` |
| | | new owner must exist and be active | `leadService.ts:139-145` | 400 `INVALID_OWNER` |
| | | `assertValidStageTransition` when `input.stage` is set | `leadService.ts:147-149` | 409 `INVALID_STAGE_TRANSITION` |
| `POST /api/leads/:id/notes` | any session | `canAccessLead(user, lead.ownerId)` | `noteService.ts:23-27` | 403 `NOTE_ACCESS_DENIED` |
| `POST /api/leads/:id/follow-ups` | any session | `canEditLead(user, lead.ownerId)` | `followUpService.ts:41-43` | 403 `FOLLOW_UP_ACCESS_DENIED` |
| | | assignee must be caller unless `canReassignLead` | `followUpService.ts:45-47` | 403 `FOLLOW_UP_ASSIGNMENT_DENIED` |
| | | assignee must exist and be active | `followUpService.ts:49-53` | 400 `INVALID_FOLLOW_UP_OWNER` |
| `PATCH /api/follow-ups/:id` | any session | `canManageFollowUp(user, followUp.ownerId)` | `followUpService.ts:92-94` | 403 `FOLLOW_UP_STATUS_DENIED` |
| | | status must still be `PENDING` | `followUpService.ts:96-100` | 409 `INVALID_FOLLOW_UP_TRANSITION` |

Pages:

| Page | Gate | File:line |
| --- | --- | --- |
| `/` | `requirePageSession()` | `src/app/page.tsx:5` |
| `/leads/[leadId]` | `requirePageSession()`; the lead itself is loaded client-side through `GET /api/leads/:id` | `src/app/leads/[leadId]/page.tsx:17` |
| `/login` | redirects to `/` if a valid session exists | `src/app/login/page.tsx:14-18` |

The lead page renders its shell for any logged-in user and any id. Access to the lead's data is enforced by the API call, not by the page.

## Permission matrix

`rolePermissions` (`src/lib/auth/permissions.ts:10-32`), as returned by `hasPermission()`:

| Permission | ADMIN | MANAGER | REP | Where it is checked |
| --- | --- | --- | --- | --- |
| `viewAllLeads` | yes | yes | no | `canAccessLead` (`permissions.ts:43`), both `getLeadVisibility` functions |
| `createLead` | yes | yes | yes | **nowhere** |
| `editAnyLead` | yes | yes | no | `canEditLead` (`permissions.ts:47`) |
| `reassignLead` | yes | yes | no | `canReassignLead` (`permissions.ts:51`) |
| `manageAllFollowUps` | yes | yes | no | `canManageFollowUp` (`permissions.ts:55`) |

The helper results for a rep, read from `permissions.ts:40-56`:

| Helper | Rep on own lead / own follow-up | Rep on someone else's |
| --- | --- | --- |
| `canAccessLead` | true | false |
| `canEditLead` | true | false |
| `canReassignLead` | false | false |
| `canManageFollowUp` | true | false |

## Can a rep read or edit another rep's lead by id?

This was the main question for this review. The answer at the service layer is **no**, for every lead-scoped action. Trace it with lead `L1` owned by `rep2` and each service called as `rep`:

| Action as `rep` on `rep2`'s lead | Service result (from the cited checks) |
| --- | --- |
| `getLeadDetail` | 403 `LEAD_ACCESS_DENIED` |
| `getLeadDetail` on a missing id | 404 `LEAD_NOT_FOUND` |
| `updateLeadRecord` with `{ companyName }` | 403 `LEAD_EDIT_DENIED` |
| `updateLeadRecord` with `{ ownerId: "rep" }` (try to take it) | 403 `LEAD_EDIT_DENIED` |
| `addLeadNote` | 403 `NOTE_ACCESS_DENIED` |
| `addLeadFollowUp` | 403 `FOLLOW_UP_ACCESS_DENIED` |
| `changeFollowUpStatus` on `rep2`'s follow-up | 403 `FOLLOW_UP_STATUS_DENIED` |
| `getLeadDetail` as manager | allowed |

The checks run before any write, and they read `ownerId` from the database row, not from the request. The `leadId` in the URL cannot be used to smuggle a different owner.

The answer for follow-ups is more subtle; see finding A4.

## Findings

Each finding has evidence, how it was checked, and a fix sketch.

### A1. Error mapping is bypassed on six handlers

- Evidence: `return withAuth(...)` without `await` at `src/app/api/leads/route.ts:18`, `src/app/api/leads/[leadId]/route.ts:18` and `:32`, `src/app/api/leads/[leadId]/notes/route.ts:21`, `src/app/api/leads/[leadId]/follow-ups/route.ts:21`, `src/app/api/follow-ups/[followUpId]/route.ts:21`. Compare `src/app/api/dashboard/route.ts:19`, which has `return await`.
- Effect: 401, 403, 404, 409 and 400 never reach the client from these routes. The client gets 500 and the UI shows "Request failed.". Server logs show an unhandled error instead of a clean `toErrorResponse` path.
- Why: inside an `async` function, `return promise` from a `try` block hands the promise back without waiting, so a later rejection is never seen by that `catch`. `return await promise` waits inside the `try`. This is a language rule, not a Next.js quirk.
- Fix: `return await withAuth(...)` in each handler. Add a route-level test per handler that asserts the status code, not just the thrown error.

### A2. Single-record denial reveals existence (by reading)

- Evidence: `getLeadDetail()` throws 404 for a missing id (`leadService.ts:57-59`) and 403 for someone else's lead (`:61-63`). Same pattern in `addLeadNote()`, `addLeadFollowUp()`, `updateLeadRecord()` and `changeFollowUpStatus()`.
- Effect: a rep can tell whether an id exists. Ids are `cuid()` (`prisma/schema.prisma:75`), which are hard to guess, so the practical risk is low. It still matters if ids leak through URLs or logs.
- Fix: return 404 for both cases to non-privileged callers, or accept the trade-off and write it down.

### A3. Reps see lead names through the upcoming follow-ups panel (by reading)

- Evidence: for a rep, `listUpcomingFollowUps()` filters by `FollowUp.ownerId = user.id` (`src/repositories/followUpRepository.ts:21`, called from `dashboardService.ts:38`). It does not check who owns the lead. The include returns `lead.companyName`, `contactName` and `stage` (`followUpRepository.ts:31-37`).
- Effect: if a manager assigns `rep` a follow-up on `rep2`'s lead (allowed by `followUpService.ts:45`), `rep` sees that lead's company, contact and stage on the dashboard, but gets 403 when they click through. `getLeadDetail()` still checks the lead owner (`leadService.ts:61-63`), so the click-through is denied.
- Fix: decide the rule. Either a follow-up assignee is allowed to see the lead (then extend `canAccessLead`), or follow-ups may only be assigned to the lead owner (then validate it in `addLeadFollowUp`).

### A4. Follow-up status checks the follow-up owner, not the lead owner

- Evidence: `changeFollowUpStatus()` calls `canManageFollowUp(user, followUp.ownerId)` (`followUpService.ts:92`). `findFollowUpById()` loads `lead.ownerId` (`followUpRepository.ts:49-54`) but nothing reads it.
- Effect, both directions:
  - `rep` completed a follow-up on `rep2`'s lead, which `rep` cannot open. Result: allowed.
  - `rep2` owns the lead but the follow-up is assigned to `rep`. `rep2` tried to cancel it. Result: 403 `FOLLOW_UP_STATUS_DENIED`.
- Also: reassigning a lead does not move its follow-ups. `updateLeadRecord()` writes `ownerId` on the lead only (`leadService.ts:161`). The old owner keeps the pending follow-ups and can still complete them.
- Fix: check `canEditLead(user, followUp.lead.ownerId) || user.id === followUp.ownerId`, and decide whether lead reassignment should reassign pending follow-ups.

### A5. Sessions cannot be revoked and do not see role changes (by reading)

- Evidence: `src/lib/auth/session.ts:22-28` (7-day JWT with role inside), `:58-61` (logout only deletes the cookie), `src/services/authService.ts:18` (`isActive` checked only at login).
- Fix: re-load the user by id in `withAuth()` (one indexed query) and reject inactive users, or keep a short token lifetime plus a refresh step.

### A6. One permission is never enforced (by search)

- Evidence: `createLead` is defined for all three roles (`permissions.ts:13`, `:20`, `:27`). A search of `src/` finds no `hasPermission(user, "createLead")`. `POST /api/leads` allows any authenticated user.
- Effect: none today, since every role has it. The trap is that a future change to `REP: { createLead: false }` would look like it works and would not.
- Fix: call `hasPermission(user, "createLead")` in `createLeadRecord()`, or delete the key.

### A7. Lead creation skips the stage machine

- Evidence: `createLeadSchema.stage` accepts every enum value (`leadSchemas.ts:34`). `createLeadRecord()` writes `input.stage` without a check (`leadService.ts:101`).
- Consequence: a rep can `POST` a lead with `stage: "WON"` and it is stored as `WON`, skipping every step of the pipeline.
- Fix: restrict creation to `NEW` (or a small set) in the schema or the service.

## Debugging scenarios

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Rep opens a lead link and sees "Request failed." | The lead belongs to someone else; the 403 became a 500 | finding A1; `leadService.ts:61`; `leads/[leadId]/route.ts:18` |
| Logged-out user hits an API route and gets 500, not 401 | Same missing `await` | finding A1 |
| Manager filter by owner works, rep filter by owner gives 403 | Expected; `withRole` at `dashboard/route.ts:25` | this doc, gate table |
| A user you deactivated can still use the app | Session is a 7-day JWT; `isActive` only checked at login | finding A5 |
| Rep sees a company on the dashboard but cannot open it | Follow-up assigned to them on another rep's lead | finding A3 |
| Lead owner cannot complete a follow-up on their own lead | Follow-up is assigned to someone else | finding A4 |
| Every request fails at import with a Zod error about `SESSION_SECRET` | Secret missing or shorter than 32 characters | `src/lib/env.ts:12` |

## Exercises

1. A teammate proposes changing `canAccessLead` to `return user.role !== "REP" || user.id === ownerId`. Is it equivalent today? Answer: yes for the three current roles, because only `REP` has `viewAllLeads: false`. It stops being equivalent the moment a new role is added, which is why the permission map exists.
2. Which route would leak data if `buildLeadWhere()` lost its `visibility.ownerId` branch (`leadRepository.ts:43-49`)? Answer: only `GET /api/dashboard`, through `listLeads()` and `getLeadStageCounts()`. `GET /api/leads/:id` does not use `buildLeadWhere()`; it relies on `canAccessLead()` in `getLeadDetail()`.
3. A rep sends `GET /api/dashboard?mineOnly=true&ownerId=<other rep>`. What happens? Answer: 403. The `withRole` check at `dashboard/route.ts:22-26` runs on `filters.ownerId` before `mineOnly` is applied on line 30.
4. Where would you add a check so that deactivated users are locked out immediately? Answer: inside `withAuth()` after line 18, load the user with `findUserById()` and throw 401 if missing or inactive. Pages would need the same in `requirePageSession()`.
