import { db } from "@/lib/db";
import { canEditLead, canManageFollowUp, canReassignLead } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/api-error";
import type { SessionUser } from "@/lib/types/auth";
import { createActivityLog } from "@/repositories/activityRepository";
import {
  createFollowUp,
  findFollowUpById,
  listPendingFollowUpsForLead,
  updateFollowUpStatus,
} from "@/repositories/followUpRepository";
import { findLeadById, updateLeadNextFollowUp } from "@/repositories/leadRepository";
import type { DatabaseClient } from "@/repositories/shared";
import { findUserById } from "@/repositories/userRepository";

/**
 * This file owns follow-up creation and completion rules, including synchronization
 * of the lead's nextFollowUpAt field.
 * What calls it: follow-up API routes.
 * What it calls: follow-up, lead, activity, and user repositories.
 * A junior engineer would likely get this wrong by updating the follow-up row
 * but forgetting the parent lead summary fields used by the dashboard.
 */
async function syncLeadNextFollowUp(transaction: DatabaseClient, leadId: string) {
  const pending = await listPendingFollowUpsForLead(transaction, leadId);
  const nextFollowUpAt = pending[0]?.dueAt ?? null;
  await updateLeadNextFollowUp(transaction, leadId, nextFollowUpAt);
}

export async function addLeadFollowUp(
  user: SessionUser,
  leadId: string,
  input: { ownerId: string; description: string; dueAt: Date },
) {
  const lead = await findLeadById(db, leadId);

  if (!lead) {
    throw new ApiError("Lead not found.", 404, "LEAD_NOT_FOUND");
  }

  if (!canEditLead(user, lead.ownerId)) {
    throw new ApiError("You cannot create follow-ups for this lead.", 403, "FOLLOW_UP_ACCESS_DENIED");
  }

  if (input.ownerId !== user.id && !canReassignLead(user)) {
    throw new ApiError("You cannot assign follow-ups to other users.", 403, "FOLLOW_UP_ASSIGNMENT_DENIED");
  }

  const owner = await findUserById(db, input.ownerId);

  if (!owner || !owner.isActive) {
    throw new ApiError("Assigned follow-up owner was not found.", 400, "INVALID_FOLLOW_UP_OWNER");
  }

  return db.$transaction(async (transaction) => {
    const followUp = await createFollowUp(transaction, {
      leadId,
      ownerId: input.ownerId,
      createdById: user.id,
      description: input.description,
      dueAt: input.dueAt,
    });

    await syncLeadNextFollowUp(transaction, leadId);

    await createActivityLog(transaction, {
      leadId,
      actorId: user.id,
      type: "FOLLOW_UP_CREATED",
      message: `${user.name} scheduled a follow-up.`,
      metadata: {
        followUpId: followUp.id,
        dueAt: input.dueAt.toISOString(),
      },
    });

    return followUp;
  });
}

export async function changeFollowUpStatus(
  user: SessionUser,
  followUpId: string,
  status: "COMPLETED" | "CANCELED",
) {
  const followUp = await findFollowUpById(db, followUpId);

  if (!followUp) {
    throw new ApiError("Follow-up not found.", 404, "FOLLOW_UP_NOT_FOUND");
  }

  if (!canManageFollowUp(user, followUp.ownerId)) {
    throw new ApiError("You cannot update this follow-up.", 403, "FOLLOW_UP_STATUS_DENIED");
  }

  if (followUp.status !== "PENDING") {
    // ⚠️ SENIOR NOTE: completed/canceled follow-ups are historical facts; letting
    // them bounce back to mutable states makes the operational timeline unreliable.
    throw new ApiError("Only pending follow-ups can change status.", 409, "INVALID_FOLLOW_UP_TRANSITION");
  }

  return db.$transaction(async (transaction) => {
    const updated = await updateFollowUpStatus(
      transaction,
      followUpId,
      status,
      status === "COMPLETED" ? new Date() : null,
    );

    await syncLeadNextFollowUp(transaction, followUp.leadId);

    await createActivityLog(transaction, {
      leadId: followUp.leadId,
      actorId: user.id,
      type: status === "COMPLETED" ? "FOLLOW_UP_COMPLETED" : "FOLLOW_UP_CANCELED",
      message:
        status === "COMPLETED"
          ? `${user.name} completed a follow-up.`
          : `${user.name} canceled a follow-up.`,
      metadata: {
        followUpId,
        status,
      },
    });

    return updated;
  });
}
