import { db } from "@/lib/db";
import { ApiError } from "@/lib/http/api-error";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/types/auth";
import { findUserByEmail } from "@/repositories/userRepository";

/**
 * This file owns the credential login workflow and strips the user down to the
 * session-safe shape before cookies are created.
 * What calls it: src/app/api/auth/login/route.ts.
 * What it calls: userRepository and password verification helpers.
 * A junior engineer would likely get this wrong by returning the Prisma user
 * model directly, which would leak passwordHash into the route layer.
 */
export async function authenticateUser(email: string, password: string): Promise<SessionUser> {
  const user = await findUserByEmail(db, email);

  if (!user || !user.isActive) {
    // ⚠️ SENIOR NOTE: keep the same error for missing and wrong-password users
    // so the login flow does not become an account-enumeration endpoint.
    throw new ApiError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    throw new ApiError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
