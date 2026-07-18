import { NextRequest } from "next/server";

import { parseJsonBody } from "@/lib/http/request";
import { created, toErrorResponse } from "@/lib/http/responses";
import { withAuth } from "@/lib/middleware/withAuth";
import { createLeadSchema } from "@/lib/validation/leadSchemas";
import { createLeadRecord } from "@/services/leadService";

/**
 * This file handles lead creation requests.
 * What calls it: src/hooks/use-dashboard.ts via the create lead form.
 * What it calls: withAuth, createLeadSchema, and leadService.
 * A junior engineer would likely get this wrong by letting the client set
 * createdById directly instead of deriving it from the authenticated session.
 */
export async function POST(request: NextRequest) {
  try {
    return withAuth(request, async ({ user }) => {
      const input = await parseJsonBody(request, createLeadSchema);
      return created(await createLeadRecord(user, input));
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

