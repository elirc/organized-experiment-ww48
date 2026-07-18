import { NextRequest } from "next/server";

import { parseJsonBody } from "@/lib/http/request";
import { ok, toErrorResponse } from "@/lib/http/responses";
import { withAuth } from "@/lib/middleware/withAuth";
import { updateLeadSchema } from "@/lib/validation/leadSchemas";
import { getLeadDetail, updateLeadRecord } from "@/services/leadService";

/**
 * This file handles lead detail reads and updates.
 * What calls it: src/hooks/use-lead-detail.ts and lead detail forms.
 * What it calls: withAuth, lead validation schemas, and leadService.
 * A junior engineer would likely get this wrong by sharing the PATCH schema with
 * POST without making fields optional and then encouraging partial-update bugs.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  try {
    return withAuth(request, async ({ user }) => {
      const { leadId } = await context.params;
      return ok(await getLeadDetail(user, leadId));
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  try {
    return withAuth(request, async ({ user }) => {
      const { leadId } = await context.params;
      const input = await parseJsonBody(request, updateLeadSchema);
      return ok(await updateLeadRecord(user, leadId, input));
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

