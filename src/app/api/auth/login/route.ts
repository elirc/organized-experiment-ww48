import { NextRequest } from "next/server";

import { createSession } from "@/lib/auth/session";
import { parseJsonBody } from "@/lib/http/request";
import { ok, toErrorResponse } from "@/lib/http/responses";
import { loginSchema } from "@/lib/validation/authSchemas";
import { authenticateUser } from "@/services/authService";

/**
 * This file handles credential login and session-cookie creation.
 * What calls it: the login form in src/components/auth/login-form.tsx.
 * What it calls: auth validation, authService, and session-cookie helpers.
 * A junior engineer would likely get this wrong by issuing the cookie before
 * credentials are verified or by trusting the browser form values directly.
 */
export async function POST(request: NextRequest) {
  try {
    const input = await parseJsonBody(request, loginSchema);
    const user = await authenticateUser(input.email, input.password);

    await createSession(user);

    return ok({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}

