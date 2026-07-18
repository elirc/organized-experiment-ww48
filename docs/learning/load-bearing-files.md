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

