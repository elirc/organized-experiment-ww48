# CRM Lead Pipeline

Production-style CRM lead pipeline built with Next.js, TypeScript, PostgreSQL, Prisma, Zod, Tailwind, React Query, and REST APIs.

## What’s inside

- Lead stages with controlled transitions
- Explicit ownership and role-based permissions
- Notes and follow-up workflows
- Activity log / audit trail
- Code-anchored architecture and learning docs in `docs/architecture/` and `docs/learning/`

The rules above are real, and most of them hold. A code review of this repo (recorded in the docs listed below) also found places where they do not hold in practice. The short list is in [Known issues](#known-issues-verified) at the end of this file. Read it before you trust any HTTP status code this app returns.

## Local setup

1. Copy `.env.example` to `.env.local`
2. Start PostgreSQL with `docker-compose up -d`
3. Generate Prisma client with `npx prisma@6.7.0 generate`
4. Push the schema with `npx prisma@6.7.0 db push`
5. Seed demo data with `npm run db:seed`
6. Start the app with `npm run dev`

**Correction (step 1):** there is no `.env.example` in this repo (`git ls-files` lists none; `.gitignore` would allow one through, but it was never committed). Create the file by hand. Two variables are required, and both are validated at import time by `src/lib/env.ts:10-21`:

| Variable | Rule (from `src/lib/env.ts`) | Value that matches `docker-compose.yml` |
| --- | --- | --- |
| `DATABASE_URL` | must be a URL (`z.url()`, line 11) | `postgresql://postgres:postgres@localhost:5432/crm_pipeline?schema=public` |
| `SESSION_SECRET` | at least 32 characters (line 12) | any random string of 32+ characters |

**Correction (file name):** put these in `.env`, not only in `.env.local`. Next.js reads both files, but the Prisma CLI (steps 3 and 4) and the seed script (step 5, which runs `tsx prisma/seed.ts` directly, `package.json:15`) only pick up `.env`. With `.env.local` alone, `prisma db push` cannot find `DATABASE_URL`. (From the tools' documented behavior; nothing was installed or run for this review.)

**Missing step:** run `npm install` before step 3. `tsx`, `prisma`, `vitest` and `next` are all project dependencies (`package.json:17-45`), so none of the later steps work on a fresh clone without it.

The resulting order is:

1. `npm install`
2. Create `.env` with `DATABASE_URL` and `SESSION_SECRET` (see the table)
3. `docker-compose up -d` (Postgres 16 on port 5432, database `crm_pipeline`, user and password `postgres`, from `docker-compose.yml:3-13`)
4. `npx prisma@6.7.0 generate`
5. `npx prisma@6.7.0 db push` (there is no `prisma/migrations/` folder, so `db push` is the only way to create tables)
6. `npm run db:seed`
7. `npm run dev`

## npm scripts

All scripts come from `package.json:5-16`.

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `next dev` | Next.js 16.2.4 |
| `build` / `start` | `next build` / `next start` | production build and serve |
| `lint` | `eslint .` | config in `eslint.config.mjs` |
| `test` | `vitest` | watch mode in an interactive terminal; see `docs/learning/testing-rationale.md` |
| `test:run` | `vitest run` | single run, use this in CI |
| `prisma:generate` | `prisma generate` | required before 2 of the 4 test files can import (see testing doc) |
| `prisma:migrate:dev` | `prisma migrate dev` | would create the first migration; none is committed |
| `db:push` | `prisma db push` | same as setup step 5 |
| `db:seed` | `tsx prisma/seed.ts` | also wired as the Prisma seed command (`package.json:46-48`) |

## Demo users

- `admin@crm.local` / `Password123!`
- `manager@crm.local` / `Password123!`
- `rep@crm.local` / `Password123!`

What the seed actually creates (`prisma/seed.ts`):

- The three users above, upserted by email (lines 87-103). Re-running the seed resets their password and sets `isActive: true`.
- It deletes every activity log, follow-up, note and lead first (lines 109-112). Re-seeding wipes any data you created by hand.
- Three leads: Northwind Logistics (`QUALIFIED`), Harbor Health Group (`PROPOSAL`), Summit Devices (`NEGOTIATION`) (lines 42-82).
- All three leads are owned by the rep and created by the manager (lines 126-127). The manager and admin own nothing. To see ownership isolation you need a second rep; the seed does not create one.
- One note, one follow-up and two activity rows per lead (lines 133-168). The Summit Devices follow-up is already `COMPLETED`.
- The seed hashes with bcrypt cost 10 (line 85). The app hashes with cost 12 (`src/lib/auth/password.ts:11`). Both verify fine; only new hashes differ.

## Learning docs

- `docs/architecture/README.md`
- `docs/architecture/request-lifecycle.md`
- `docs/learning/guided-reading-path.md`
- `docs/learning/flow-traces.md`

The full set:

| Doc | What it covers |
| --- | --- |
| [`docs/architecture/README.md`](docs/architecture/README.md) | layers, folders, route inventory, error contract |
| [`docs/architecture/auth-and-permissions.md`](docs/architecture/auth-and-permissions.md) | session, roles, ownership, route gate table, numbered findings |
| [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md) | schema, indexes, the two state machines, invariants |
| [`docs/architecture/request-lifecycle.md`](docs/architecture/request-lifecycle.md) | happy paths plus what really happens on errors |
| [`docs/learning/guided-reading-path.md`](docs/learning/guided-reading-path.md) | 12-step reading order with exercises and answers |
| [`docs/learning/flow-traces.md`](docs/learning/flow-traces.md) | step-by-step traces, including failure and race traces |
| [`docs/learning/load-bearing-files.md`](docs/learning/load-bearing-files.md) | the files that matter most, plus debugging scenarios |
| [`docs/learning/concepts-demonstrated.md`](docs/learning/concepts-demonstrated.md) | concepts, where they live, where they are incomplete |
| [`docs/learning/testing-rationale.md`](docs/learning/testing-rationale.md) | what the 4 tests prove and miss, tests to add |
| [`docs/learning/build-journal.md`](docs/learning/build-journal.md) | design decisions, plus post-build review notes |

## Known issues (verified)

Each item has a full write-up with evidence in the linked doc. All of them come from reading the code; nothing was installed or executed for this review, so treat the runtime consequences as predictions to confirm.

1. **Six of seven authenticated API handlers return 500 instead of 401/403/404/409/400.** They `return withAuth(...)` without `await` inside `try`, so the `catch` that maps errors never runs. Only `GET /api/dashboard` uses `return await`. (See `docs/architecture/request-lifecycle.md`, "What actually happens on errors".)
2. **`PATCH /api/leads/:id` without a `stage` field is treated as "move to NEW".** `updateLeadSchema` is `createLeadSchema.partial()`, and the `.default("NEW")` on `stage` still fills in. Any API edit of a non-NEW lead that omits `stage` fails the transition check. The "at least one field" guard never fires either. This relies on Zod 4 applying defaults inside optional fields. (See `docs/architecture/domain-model.md`, "Stage machine".)
3. **Follow-up completion and lead stage changes are check-then-act races.** Two concurrent requests both pass the "is it still PENDING?" or "is this transition legal?" check, both write, and both log. (See `docs/learning/flow-traces.md`, race traces.)
4. **Follow-up permissions follow the follow-up owner, not the lead owner.** A rep can complete a follow-up on a lead they cannot open, and a lead owner can be locked out of a follow-up on their own lead. (See `docs/architecture/auth-and-permissions.md`, finding A4.)
5. **Lead creation accepts any stage, including `WON` and `LOST`.** The transition map only runs on update (`src/lib/validation/leadSchemas.ts:34`, `src/services/leadService.ts:101`).
6. **Sessions are not revocable.** Role and identity live in a 7-day JWT; deactivating or demoting a user has no effect until it expires (`src/lib/auth/session.ts:22-28`).
