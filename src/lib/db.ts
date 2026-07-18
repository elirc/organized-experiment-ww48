import { PrismaClient } from "@prisma/client";

/**
 * This file owns the Prisma client singleton for the whole application.
 * What calls it: repositories that issue database queries.
 * What it calls: the generated Prisma client.
 * A junior engineer would likely get this wrong by instantiating Prisma in each
 * repository, which causes connection churn during development and testing.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

