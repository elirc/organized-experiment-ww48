import { destroySession } from "@/lib/auth/session";
import { noContent, toErrorResponse } from "@/lib/http/responses";

/**
 * This file clears the session cookie for logout requests.
 * What calls it: dashboard and lead detail logout buttons.
 * What it calls: the shared session helper.
 * A junior engineer would likely get this wrong by trying to clear auth only in
 * client state and leaving the server cookie valid.
 */
export async function POST() {
  try {
    await destroySession();
    return noContent();
  } catch (error) {
    return toErrorResponse(error);
  }
}

