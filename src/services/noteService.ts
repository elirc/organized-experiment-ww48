import { db } from "@/lib/db";
import { canAccessLead } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/api-error";
import type { SessionUser } from "@/lib/types/auth";
import { createActivityLog } from "@/repositories/activityRepository";
import { findLeadById } from "@/repositories/leadRepository";
import { createNote } from "@/repositories/noteRepository";

/**
 * This file owns note creation so notes always inherit lead access checks and audit logging.
 * What calls it: src/app/api/leads/[leadId]/notes/route.ts.
 * What it calls: leadRepository, noteRepository, and activityRepository.
 * A junior engineer would likely get this wrong by exposing a standalone note
 * write route that never verifies the caller can see the parent lead.
 */
export async function addLeadNote(user: SessionUser, leadId: string, body: string) {
  const lead = await findLeadById(db, leadId);

  if (!lead) {
    throw new ApiError("Lead not found.", 404, "LEAD_NOT_FOUND");
  }

  if (!canAccessLead(user, lead.ownerId)) {
    // ⚠️ SENIOR NOTE: note creation must inherit lead visibility; otherwise
    // child-resource writes become a privilege-escalation path.
    throw new ApiError("You cannot add a note to this lead.", 403, "NOTE_ACCESS_DENIED");
  }

  return db.$transaction(async (transaction) => {
    const note = await createNote(transaction, {
      leadId,
      authorId: user.id,
      body,
    });

    await createActivityLog(transaction, {
      leadId,
      actorId: user.id,
      type: "NOTE_ADDED",
      message: `${user.name} added a note.`,
    });

    return note;
  });
}
