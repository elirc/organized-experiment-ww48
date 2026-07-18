import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/http/api-error";
import { getRequestSession } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/types/auth";

/**
 * This file enforces that API requests have a valid session before they reach business logic.
 * What calls it: App Router route handlers under src/app/api/.
 * What it calls: session verification and the shared ApiError contract.
 * A junior engineer would likely get this wrong by authenticating in some routes
 * but not others, leaving "internal" endpoints accidentally public.
 */
export async function withAuth(
  request: NextRequest,
  handler: (context: AuthContext) => Promise<Response>,
) {
  const user = await getRequestSession(request);

  if (!user) {
    // ⚠️ SENIOR NOTE: route auth must reject before business logic runs; do not
    // rely on component redirects or hidden buttons as your "authorization".
    throw new ApiError("You must be logged in to access this resource.", 401, "UNAUTHORIZED");
  }

  return handler({ user });
}
