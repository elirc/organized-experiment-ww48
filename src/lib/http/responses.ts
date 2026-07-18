import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError } from "@/lib/http/api-error";

/**
 * This file centralizes JSON success and error response formatting.
 * What calls it: API route handlers after service execution or when catching errors.
 * What it calls: NextResponse and the shared ApiError contract.
 * A junior engineer would likely get this wrong by returning different error
 * shapes from different routes, which makes front-end handling brittle.
 */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        code: "VALIDATION_ERROR",
        issues: error.flatten(),
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode },
    );
  }

  // ⚠️ SENIOR NOTE: never leak raw error objects to clients; stack traces often
  // include implementation details or secrets that turn a bug into an incident.
  console.error(error);

  return NextResponse.json(
    {
      error: "Internal server error.",
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 },
  );
}

