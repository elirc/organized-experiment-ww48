import { NextRequest } from "next/server";

import { parseJsonBody } from "@/lib/http/request";
import { ok, toErrorResponse } from "@/lib/http/responses";
import { withAuth } from "@/lib/middleware/withAuth";
import { updateFollowUpStatusSchema } from "@/lib/validation/leadSchemas";
import { changeFollowUpStatus } from "@/services/followUpService";

/**
 * This file handles follow-up completion and cancellation.
 * What calls it: src/hooks/use-lead-detail.ts and dashboard action buttons.
 * What it calls: withAuth, the follow-up status schema, and followUpService.
 * A junior engineer would likely get this wrong by exposing "status" as a free
 * string and letting clients invent unsupported workflow values.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ followUpId: string }> },
) {
  try {
    return withAuth(request, async ({ user }) => {
      const { followUpId } = await context.params;
      const input = await parseJsonBody(request, updateFollowUpStatusSchema);
      return ok(await changeFollowUpStatus(user, followUpId, input.status));
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

