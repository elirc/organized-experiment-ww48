import type { DatabaseClient } from "@/repositories/shared";

/**
 * This file owns user-read queries used by authentication and lead assignment flows.
 * What calls it: authService, dashboardService, and leadService.
 * What it calls: Prisma through the shared database client.
 * A junior engineer would likely get this wrong by returning the full user record,
 * including password hashes, to callers that do not need sensitive fields.
 */
export async function findUserByEmail(client: DatabaseClient, email: string) {
  return client.user.findUnique({
    where: { email },
  });
}

export async function findUserById(client: DatabaseClient, userId: string) {
  return client.user.findUnique({
    where: { id: userId },
  });
}

export async function listAssignableUsers(client: DatabaseClient) {
  return client.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

