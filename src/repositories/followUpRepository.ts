import { Prisma, type FollowUpStatus } from "@prisma/client";

import type { DatabaseClient } from "@/repositories/shared";

/**
 * This file owns follow-up reads and writes, including the operational dashboard query.
 * What calls it: dashboardService and followUpService.
 * What it calls: Prisma through the shared database-client contract.
 * A junior engineer would likely get this wrong by forgetting to keep the lead's
 * denormalized nextFollowUpAt field in sync with follow-up changes.
 */
export async function listUpcomingFollowUps(
  client: DatabaseClient,
  visibility: { ownerId?: string },
) {
  return client.followUp.findMany({
    where: {
      status: "PENDING",
      // ⚠️ SENIOR NOTE: operational lists are still subject to ownership scope;
      // "upcoming tasks" endpoints are a common accidental leak vector.
      ...(visibility.ownerId ? { ownerId: visibility.ownerId } : {}),
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      lead: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          stage: true,
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: 8,
  });
}

export async function findFollowUpById(client: DatabaseClient, followUpId: string) {
  return client.followUp.findUnique({
    where: { id: followUpId },
    include: {
      lead: {
        select: {
          id: true,
          ownerId: true,
          companyName: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
}

export async function listPendingFollowUpsForLead(client: DatabaseClient, leadId: string) {
  return client.followUp.findMany({
    where: {
      leadId,
      status: "PENDING",
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function createFollowUp(
  client: DatabaseClient,
  data: Prisma.FollowUpUncheckedCreateInput,
) {
  return client.followUp.create({
    data,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
}

export async function updateFollowUpStatus(
  client: DatabaseClient,
  followUpId: string,
  status: FollowUpStatus,
  completedAt: Date | null,
) {
  return client.followUp.update({
    where: { id: followUpId },
    data: {
      status,
      completedAt,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
}
