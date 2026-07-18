/**
 * This file defines the application error type used to convert domain failures
 * into consistent HTTP responses.
 * What calls it: middleware guards, services, and request parsing helpers.
 * What it calls: no external dependencies.
 * A junior engineer would likely get this wrong by throwing plain strings, which
 * makes route-level error handling inconsistent and hard to inspect.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

