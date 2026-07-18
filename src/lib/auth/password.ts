import bcrypt from "bcryptjs";

/**
 * This file wraps password hashing and verification so auth logic stays out of routes.
 * What calls it: authService and the Prisma seed script.
 * What it calls: bcryptjs.
 * A junior engineer would likely get this wrong by comparing plaintext passwords
 * directly or forgetting to await the async password verification path.
 */
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

