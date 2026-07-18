import { NextRequest } from "next/server";

import { parseJsonBody } from "@/lib/http/request";
import { created, toErrorResponse } from "@/lib/http/responses";
import { withAuth } from "@/lib/middleware/withAuth";
import { createNoteSchema } from "@/lib/validation/leadSchemas";
import { addLeadNote } from "@/services/noteService";

/**
 * This file handles note creation for a specific lead.
 * What calls it: src/hooks/use-lead-detail.ts through the note form.
 * What it calls: withAuth, createNoteSchema, and noteService.
 * A junior engineer would likely get this wrong by trusting the parent lead page
 * to prove access and skipping the same authorization check on the API route.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    return withAuth(request, async ({ user }) => {
      const { leadId } = await context.params;
      const input = await parseJsonBody(request, createNoteSchema);
      return created(await addLeadNote(user, leadId, input.body));
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

