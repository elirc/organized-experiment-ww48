import { NextRequest } from "next/server";

import { parseJsonBody } from "@/lib/http/request";
import { created, toErrorResponse } from "@/lib/http/responses";
import { withAuth } from "@/lib/middleware/withAuth";
import { createFollowUpSchema } from "@/lib/validation/leadSchemas";
import { addLeadFollowUp } from "@/services/followUpService";

/**
 * This file handles follow-up scheduling for a specific lead.
 * What calls it: src/hooks/use-lead-detail.ts through the follow-up form.
 * What it calls: withAuth, createFollowUpSchema, and followUpService.
 * A junior engineer would likely get this wrong by allowing unvalidated due dates,
 * which later breaks list ordering and reminder logic.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    return withAuth(request, async ({ user }) => {
      const { leadId } = await context.params;
      const input = await parseJsonBody(request, createFollowUpSchema);
      return created(await addLeadFollowUp(user, leadId, input));
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

