# CRM Lead Pipeline

Production-style CRM lead pipeline built with Next.js, TypeScript, PostgreSQL, Prisma, Zod, Tailwind, React Query, and REST APIs.

## What’s inside

- Lead stages with controlled transitions
- Explicit ownership and role-based permissions
- Notes and follow-up workflows
- Activity log / audit trail
- Code-anchored architecture and learning docs in `docs/architecture/` and `docs/learning/`

## Local setup

1. Copy `.env.example` to `.env.local`
2. Start PostgreSQL with `docker-compose up -d`
3. Generate Prisma client with `npx prisma@6.7.0 generate`
4. Push the schema with `npx prisma@6.7.0 db push`
5. Seed demo data with `npm run db:seed`
6. Start the app with `npm run dev`

## Demo users

- `admin@crm.local` / `Password123!`
- `manager@crm.local` / `Password123!`
- `rep@crm.local` / `Password123!`

## Learning docs

- `docs/architecture/README.md`
- `docs/architecture/request-lifecycle.md`
- `docs/learning/guided-reading-path.md`
- `docs/learning/flow-traces.md`

