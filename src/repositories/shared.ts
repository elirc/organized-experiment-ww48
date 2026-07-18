import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * This file defines the shared database-client type for repositories so services
 * can run the same repository functions inside or outside a transaction.
 * What calls it: repository modules and service-layer transaction boundaries.
 * What it calls: Prisma type definitions only.
 * A junior engineer would likely get this wrong by writing repository functions
 * that only accept PrismaClient, which blocks safe transactional composition later.
 */
export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

