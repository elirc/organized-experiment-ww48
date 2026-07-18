import { z } from "zod";

/**
 * This file defines the auth-related request validation boundary.
 * What calls it: the login API route.
 * What it calls: Zod.
 * A junior engineer would likely get this wrong by treating email/password as
 * trusted strings and skipping basic shape validation at the edge.
 */
export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

