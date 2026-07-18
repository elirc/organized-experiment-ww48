import type { LeadPriority, LeadSource, LeadStage } from "@prisma/client";

import { db } from "@/lib/db";
import {
  canAccessLead,
  canEditLead,
  canReassignLead,
  hasPermission,
} from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/api-error";
import type { SessionUser } from "@/lib/types/auth";
import { createActivityLog } from "@/repositories/activityRepository";
import { createLead, findLeadById, listLeads, type LeadFilters, updateLead } from "@/repositories/leadRepository";
import { findUserById } from "@/repositories/userRepository";

/**
 * This file owns lead business rules: visibility, reassignment, and stage transitions.
 * What calls it: lead API routes and other workflows that need lead checks.
 * What it calls: repositories plus the shared authorization helpers.
 * A junior engineer would likely get this wrong by letting PATCH update any field
 * directly, which silently bypasses stage-transition and reassignment rules.
 */
const allowedStageTransitions: Record<LeadStage, LeadStage[]> = {
  NEW: ["QUALIFIED", "LOST"],
  QUALIFIED: ["PROPOSAL", "LOST"],
  PROPOSAL: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

function getLeadVisibility(user: SessionUser) {
  return hasPermission(user, "viewAllLeads") ? {} : { ownerId: user.id };
}

export function assertValidStageTransition(currentStage: LeadStage, nextStage: LeadStage) {
  if (currentStage === nextStage) {
    return;
  }

  if (!allowedStageTransitions[currentStage].includes(nextStage)) {
    throw new ApiError(
      `Cannot move a lead from ${currentStage} to ${nextStage}.`,
      409,
      "INVALID_STAGE_TRANSITION",
    );
  }
}

export async function getLeadList(user: SessionUser, filters: LeadFilters) {
  return listLeads(db, filters, getLeadVisibility(user));
}

export async function getLeadDetail(user: SessionUser, leadId: string) {
  const lead = await findLeadById(db, leadId);

  if (!lead) {
    throw new ApiError("Lead not found.", 404, "LEAD_NOT_FOUND");
  }

  if (!canAccessLead(user, lead.ownerId)) {
    throw new ApiError("You do not have access to this lead.", 403, "LEAD_ACCESS_DENIED");
  }

  return lead;
}

type CreateLeadInput = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  description?: string;
  source: LeadSource;
  priority: LeadPriority;
  stage: LeadStage;
  ownerId: string;
  valueCents?: number;
};

export async function createLeadRecord(user: SessionUser, input: CreateLeadInput) {
  if (input.ownerId !== user.id && !canReassignLead(user)) {
    throw new ApiError("You cannot assign leads to other users.", 403, "OWNER_ASSIGNMENT_DENIED");
  }

  const owner = await findUserById(db, input.ownerId);

  if (!owner || !owner.isActive) {
    throw new ApiError("Assigned owner was not found.", 400, "INVALID_OWNER");
  }

  return db.$transaction(async (transaction) => {
    const lead = await createLead(transaction, {
      companyName: input.companyName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone || null,
      description: input.description || null,
      source: input.source,
      priority: input.priority,
      stage: input.stage,
      ownerId: input.ownerId,
      createdById: user.id,
      valueCents: input.valueCents,
    });

    await createActivityLog(transaction, {
      leadId: lead.id,
      actorId: user.id,
      type: "LEAD_CREATED",
      message: `${user.name} created the lead.`,
      metadata: {
        stage: lead.stage,
        ownerId: lead.owner.id,
      },
    });

    return lead;
  });
}

type UpdateLeadInput = Partial<CreateLeadInput>;

export async function updateLeadRecord(user: SessionUser, leadId: string, input: UpdateLeadInput) {
  const lead = await findLeadById(db, leadId);

  if (!lead) {
    throw new ApiError("Lead not found.", 404, "LEAD_NOT_FOUND");
  }

  if (!canEditLead(user, lead.ownerId)) {
    throw new ApiError("You cannot edit this lead.", 403, "LEAD_EDIT_DENIED");
  }

  if (input.ownerId && input.ownerId !== lead.ownerId && !canReassignLead(user)) {
    throw new ApiError("You cannot reassign this lead.", 403, "OWNER_ASSIGNMENT_DENIED");
  }

  if (input.ownerId && input.ownerId !== lead.ownerId) {
    const owner = await findUserById(db, input.ownerId);

    if (!owner || !owner.isActive) {
      throw new ApiError("Assigned owner was not found.", 400, "INVALID_OWNER");
    }
  }

  if (input.stage) {
    assertValidStageTransition(lead.stage, input.stage);
  }

  return db.$transaction(async (transaction) => {
    const updatedLead = await updateLead(transaction, leadId, {
      companyName: input.companyName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone === "" ? null : input.phone,
      description: input.description === "" ? null : input.description,
      source: input.source,
      priority: input.priority,
      valueCents: input.valueCents,
      ownerId: input.ownerId,
      stage: input.stage,
      lastContactedAt: new Date(),
    });

    // ⚠️ SENIOR NOTE: activity logging is inside the same transaction so the
    // lead write and the audit trail cannot disagree after a partial failure.
    if (input.stage && input.stage !== lead.stage) {
      await createActivityLog(transaction, {
        leadId,
        actorId: user.id,
        type: "STAGE_CHANGED",
        message: `${user.name} moved the lead from ${lead.stage} to ${input.stage}.`,
        metadata: {
          from: lead.stage,
          to: input.stage,
        },
      });
    }

    if (input.ownerId && input.ownerId !== lead.ownerId) {
      await createActivityLog(transaction, {
        leadId,
        actorId: user.id,
        type: "OWNER_CHANGED",
        message: `${user.name} reassigned the lead.`,
        metadata: {
          fromOwnerId: lead.ownerId,
          toOwnerId: input.ownerId,
        },
      });
    }

    const changedNonAuditFields = ["companyName", "contactName", "email", "phone", "description", "source", "priority", "valueCents"].some(
      (key) => key in input,
    );

    if (changedNonAuditFields) {
      await createActivityLog(transaction, {
        leadId,
        actorId: user.id,
        type: "DETAILS_UPDATED",
        message: `${user.name} updated lead details.`,
      });
    }

    return updatedLead;
  });
}
