# Load-Bearing Files

## src/lib/auth/session.ts
- What it does: Signs and verifies the session cookie for both pages and APIs.
- What calls it: `src/app/api/auth/login/route.ts`, `src/lib/middleware/withAuth.ts`, `src/app/page.tsx`, `src/app/leads/[leadId]/page.tsx`
- What it calls: `src/lib/env.ts`, `jose`, `next/headers`, `next/navigation`
- What would break or become insecure if this file were wrong: Users could bypass auth, keep invalid sessions, or receive overbroad session data.
- What a junior engineer would likely miswrite here: Storing the full Prisma user row in the cookie or skipping expiration entirely.

## src/lib/auth/permissions.ts
- What it does: Converts roles into reusable authorization rules.
- What calls it: `src/services/dashboardService.ts`, `src/services/leadService.ts`, `src/services/followUpService.ts`
- **Correction:** `src/services/noteService.ts` also calls it (`canAccessLead`, line 2 and line 23). The file's header comment says "middleware guards" call it too; they do not. `withRole.ts` compares role names directly and never imports `permissions.ts`.
- What it calls: `src/lib/types/auth.ts`
- What would break or become insecure if this file were wrong: Ownership checks would drift across services and eventually leak data or allow unauthorized mutations.
- What a junior engineer would likely miswrite here: Inline role comparisons scattered through services and components.

## src/repositories/leadRepository.ts
- What it does: Defines the lead query shapes and owner scoping.
- What calls it: `src/services/dashboardService.ts`, `src/services/leadService.ts`, `src/services/noteService.ts`, `src/services/followUpService.ts`
- What it calls: Prisma through `src/repositories/shared.ts`
- What would break or become insecure if this file were wrong: The dashboard and detail pages would either miss data, create N+1 behavior, or leak other owners’ leads.
- What a junior engineer would likely miswrite here: A `findMany()` query that forgets the `visibility.ownerId` condition.

## src/services/leadService.ts
- What it does: Owns lead creation, detail authorization, reassignment rules, and stage transitions.
- What calls it: `src/app/api/leads/route.ts`, `src/app/api/leads/[leadId]/route.ts`
- What it calls: `src/repositories/leadRepository.ts`, `src/repositories/userRepository.ts`, `src/repositories/activityRepository.ts`
- What would break or become insecure if this file were wrong: Invalid stage jumps, unauthorized owner changes, and missing audit logs would all become possible.
- What a junior engineer would likely miswrite here: Treating `PATCH` as a blind field merge instead of a workflow-aware update.

## src/services/followUpService.ts
- What it does: Schedules follow-ups, restricts status transitions, and maintains `Lead.nextFollowUpAt`.
- What calls it: `src/app/api/leads/[leadId]/follow-ups/route.ts`, `src/app/api/follow-ups/[followUpId]/route.ts`
- What it calls: `src/repositories/followUpRepository.ts`, `src/repositories/leadRepository.ts`, `src/repositories/activityRepository.ts`
- What would break or become insecure if this file were wrong: The dashboard would show stale follow-up timing and users could mutate follow-ups they do not own.
- What a junior engineer would likely miswrite here: Updating a follow-up row without synchronizing the parent lead summary field.
- What the shipped version gets wrong: the "only pending" check and the write are not atomic, so concurrent Complete and Cancel can both succeed (see [`flow-traces.md`](flow-traces.md)); and "users could mutate follow-ups they do not own" depends on what "own" means: the check is on the follow-up owner, not the lead owner (`line 92`).

## src/app/api/dashboard/route.ts
- What it does: Turns dashboard HTTP requests into a fully scoped read model.
- What calls it: `src/hooks/use-dashboard.ts`
- What it calls: `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, `src/lib/validation/leadSchemas.ts`, `src/services/dashboardService.ts`
- What would break or become insecure if this file were wrong: Query-param access control would weaken and reps could enumerate team data.
- What a junior engineer would likely miswrite here: Assuming filters are always harmless and sending them directly to the repository.

## src/components/dashboard/dashboard-page.tsx
- What it does: Coordinates dashboard filter state and query-driven rendering.
- What calls it: `src/app/page.tsx`
- What it calls: `src/hooks/use-dashboard.ts` and the dashboard presentation components
- What would break or become insecure if this file were wrong: The UI would become out of sync with cache invalidation, and business rules would start leaking into components.
- What a junior engineer would likely miswrite here: Embedding permission decisions or stage-transition logic in event handlers.

## src/components/leads/lead-detail-page.tsx
- What it does: Fans one lead detail query into editing, note, follow-up, and audit subfeatures.
- What calls it: `src/app/leads/[leadId]/page.tsx`
- What it calls: `src/hooks/use-lead-detail.ts` and lead detail child components
- What would break or become insecure if this file were wrong: The detail page would fragment into conflicting data sources and stale subviews.
- What a junior engineer would likely miswrite here: Fetching notes, follow-ups, and activity logs independently without a shared invalidation strategy.

## Files the original list left out

The eight files above are the right core. Review found five more that carry as much weight, because a one-line mistake in each one changes behavior across the whole app.

## src/lib/http/responses.ts
- What it does: Turns thrown values into JSON responses. `ZodError` becomes 400 (lines 26-35), `ApiError` keeps its own status (lines 37-46), everything else is logged and becomes 500 (lines 50-58).
- What calls it: the `catch` block of every route handler.
- What it calls: `NextResponse`, `ZodError`, `ApiError`.
- What would break or become insecure if this file were wrong: Every error code in the app would change at once. A version that returned `error.message` for unknown errors would leak internals; the current version correctly does not.
- What the shipped version misses: `SyntaxError` from `request.json()` is not mapped, so a malformed body is a 500.
- Why it is load-bearing in a way that is easy to miss: it only works if the route actually reaches its `catch`. Six routes do not (see the next entry).

## src/app/api/leads/[leadId]/route.ts (and the five other unawaited routes)
- What it does: Handles lead detail `GET` and `PATCH`.
- What calls it: `src/hooks/use-lead-detail.ts`.
- What it calls: `withAuth`, `parseJsonBody`, `updateLeadSchema`, `getLeadDetail`, `updateLeadRecord`.
- What would break or become insecure if this file were wrong: This is the most-used write path in the app.
- What the shipped version gets wrong: `return withAuth(...)` without `await` (lines 18 and 32). Every 401, 403, 404, 409 and 400 from this route reaches the client as 500. The same line appears in `src/app/api/leads/route.ts:18`, `notes/route.ts:21`, `follow-ups/route.ts:21` and `follow-ups/[followUpId]/route.ts:21`.
- What a junior engineer would likely miswrite here: Exactly this. `return promise` and `return await promise` look the same and behave the same until something throws inside `try`.

## src/lib/validation/leadSchemas.ts
- What it does: Defines every write payload.
- What calls it: all lead, note and follow-up routes, plus the dashboard route for `leadFilterSchema`.
- What it calls: `zod`, `src/lib/domain.ts` for the enum lists.
- What would break or become insecure if this file were wrong: Validation is the only thing between the client and the services. The services trust the parsed types completely.
- What the shipped version gets wrong: `updateLeadSchema = createLeadSchema.partial()` (line 39) keeps the `stage` default from line 34. A PATCH without `stage` arrives at the service as `stage: "NEW"`. It also lets `createLeadSchema` accept any stage on creation (line 34).
- What a junior engineer would likely miswrite here: Deriving one schema from another and assuming the derived one has no hidden values.

## src/lib/auth/session.ts, `getRequestSession()`
- Listed above as a whole file. The specific part to protect is lines 78-87, the hand-written cookie parser. It takes everything after the first `=` of the `crm_session=` entry. If the token format ever changes to one that can contain `=`, this silently truncates it and every API request becomes 401 while pages (which use `next/headers`) keep working.

## prisma/schema.prisma
- What it does: Defines the five models, six enums and seven indexes.
- What calls it: Prisma generate and `db push`; every repository relies on the generated types.
- What would break if this file were wrong: Changing `Lead.stage` to have a database default, for example, would not change app behavior (the app always sends a stage), but removing `@@index([ownerId, stage])` would slow every rep dashboard load.
- What it does not enforce: legal stage transitions, a single `PENDING`-to-terminal move per follow-up, and that a follow-up's owner can see its lead. All of these live in service code only. See [`../architecture/domain-model.md`](../architecture/domain-model.md).

## Debugging scenarios

Symptom, then cause, then where to look. Each cause comes from reading the cited lines.

| Symptom | Cause | Where to look |
| --- | --- | --- |
| Every lead page shows "Request failed." for a rep, but managers see the lead | The rep does not own it; 403 became 500 | `leadService.ts:61-63`; `leads/[leadId]/route.ts:18` (missing `await`) |
| A script that PATCHes only `companyName` fails, but the same edit in the UI works | The schema injects `stage: "NEW"`; the UI always sends the real stage | `leadSchemas.ts:34`, `:39`; `leadService.ts:147-149`; `lead-edit-form.tsx:27-37` |
| Manager reassignment through the API fails with 500 on any lead past `NEW` | Same injected stage, then 409, then 500 | as above |
| Empty PATCH body `{}` succeeds on a `NEW` lead and changes `lastContactedAt` | Guard on lines 40-47 never fires; `updateLead` always sets `lastContactedAt` | `leadSchemas.ts:39-48`; `leadService.ts:163` |
| Timeline shows both "completed a follow-up" and "canceled a follow-up" for the same item | Two concurrent status changes both passed the `PENDING` check | `followUpService.ts:86-108`; `followUpRepository.ts:108-109` |
| Timeline shows two "completed" rows | Double click; the buttons have no pending state | `follow-up-form.tsx` Complete button; same service lines |
| A lead's "next follow-up" date is later than a pending follow-up on it | Concurrent creates computed the minimum without seeing each other (by reading) | `followUpService.ts:24-28`, `:55-64` |
| Dashboard upcoming list shows a company the rep cannot open | Follow-up assigned to the rep on another rep's lead | `followUpRepository.ts:21`, `:31-37` |
| Follow-up due times are off by several hours | `datetime-local` value read in the server's time zone | `leadSchemas.ts:57`; `follow-up-form.tsx` `type="datetime-local"` input |
| Every lead edit adds a "updated lead details" row, even with no changes | `key in input` check, and the form sends every key | `leadService.ts:194-205` |
| `npm test` never finishes | `vitest` without `run` is watch mode | `package.json:10`; use `npm run test:run` |
| Two test files fail to import on a fresh clone | Prisma client not generated | `src/lib/db.ts:14-18`; run `npx prisma generate` |
| Login works but `npx prisma db push` says `DATABASE_URL` is missing | Variables are in `.env.local`, which the Prisma CLI does not read | `README.md`, setup corrections |

