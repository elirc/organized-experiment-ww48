import { Prisma, type LeadStage } from "@prisma/client";

import type { DatabaseClient } from "@/repositories/shared";

/**
 * This file owns all lead queries and keeps the include/select shape consistent.
 * What calls it: dashboardService, leadService, noteService, and followUpService.
 * What it calls: Prisma query builders and the shared database-client contract.
 * A junior engineer would likely get this wrong by issuing slightly different
 * include trees per route, which creates N+1 bugs and inconsistent response shapes.
 */
export type LeadVisibilityScope = {
  ownerId?: string;
};

export type LeadFilters = {
  stage?: LeadStage;
  ownerId?: string;
  search?: string;
};

export function buildLeadWhere(filters: LeadFilters, visibility: LeadVisibilityScope): Prisma.LeadWhereInput {
  const andConditions: Prisma.LeadWhereInput[] = [];

  if (filters.stage) {
    andConditions.push({ stage: filters.stage });
  }

  if (filters.ownerId) {
    andConditions.push({ ownerId: filters.ownerId });
  }

  if (filters.search) {
    andConditions.push({
      OR: [
        { companyName: { contains: filters.search, mode: "insensitive" } },
        { contactName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  if (visibility.ownerId) {
    // This is the current owner-isolation boundary. Multi-tenancy can later add
    // tenantId here without changing the calling service contract.
    // ⚠️ SENIOR NOTE: if this condition disappears in a refactor, every lead list
    // and dashboard query immediately becomes a cross-owner data leak.
    andConditions.push({ ownerId: visibility.ownerId });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
}

const leadCardInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  _count: {
    select: {
      notes: true,
      followUps: true,
    },
  },
} satisfies Prisma.LeadInclude;

export async function listLeads(
  client: DatabaseClient,
  filters: LeadFilters,
  visibility: LeadVisibilityScope,
) {
  return client.lead.findMany({
    where: buildLeadWhere(filters, visibility),
    include: leadCardInclude,
    orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
  });
}

export async function getLeadStageCounts(
  client: DatabaseClient,
  filters: Omit<LeadFilters, "stage">,
  visibility: LeadVisibilityScope,
) {
  return client.lead.groupBy({
    by: ["stage"],
    where: buildLeadWhere(filters, visibility),
    _count: {
      stage: true,
    },
  });
}

export async function findLeadById(client: DatabaseClient, leadId: string) {
  return client.lead.findUnique({
    where: { id: leadId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
      followUps: {
        orderBy: { dueAt: "asc" },
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
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
    },
  });
}

export async function createLead(client: DatabaseClient, data: Prisma.LeadUncheckedCreateInput) {
  return client.lead.create({
    data,
    include: leadCardInclude,
  });
}

export async function updateLead(
  client: DatabaseClient,
  leadId: string,
  data: Prisma.LeadUncheckedUpdateInput,
) {
  return client.lead.update({
    where: { id: leadId },
    data,
    include: leadCardInclude,
  });
}

export async function updateLeadNextFollowUp(
  client: DatabaseClient,
  leadId: string,
  nextFollowUpAt: Date | null,
) {
  return client.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt },
  });
}
