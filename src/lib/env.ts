import { z } from "zod";

/**
 * This file validates server-only environment variables at process startup.
 * What calls it: Prisma client setup and session token helpers.
 * What it calls: Zod for the runtime validation boundary.
 * A junior engineer would likely get this wrong by reading process.env inline in
 * random files, which makes missing configuration fail later and less clearly.
 */
const envSchema = z.object({
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters."),
});

export const env = envSchema.parse({
  // ⚠️ SENIOR NOTE: validating eagerly keeps config failures loud during boot
  // instead of surfacing later as confusing auth or database errors.
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
});
