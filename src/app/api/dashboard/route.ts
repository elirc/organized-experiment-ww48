import { NextRequest } from "next/server";

import { parseSearchParams } from "@/lib/http/request";
import { ok, toErrorResponse } from "@/lib/http/responses";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { leadFilterSchema } from "@/lib/validation/leadSchemas";
import { getDashboardData } from "@/services/dashboardService";

/**
 * This file builds the main dashboard read model used by the home page.
 * What calls it: src/hooks/use-dashboard.ts.
 * What it calls: withAuth, the lead filter schema, and dashboardService.
 * A junior engineer would likely get this wrong by exposing a large cross-user
 * dashboard dataset without applying ownership scoping before the query runs.
 */
export async function GET(request: NextRequest) {
  try {
    return await withAuth(request, async ({ user }) => {
      const filters = await parseSearchParams(request.url, leadFilterSchema);

      if (filters.ownerId && filters.ownerId !== user.id) {
        // ⚠️ SENIOR NOTE: filtering by another owner's ID is itself a privileged
        // action, even though it looks like a harmless read-only query param.
        withRole(user, ["ADMIN", "MANAGER"]);
      }

      return ok(
        await getDashboardData(user, {
          ownerId: filters.mineOnly ? user.id : filters.ownerId,
          search: filters.search,
          stage: filters.stage,
        }),
      );
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
