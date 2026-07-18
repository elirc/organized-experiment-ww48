import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/crm_pipeline?schema=public";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-session-secret-that-is-long-enough-for-signing";
