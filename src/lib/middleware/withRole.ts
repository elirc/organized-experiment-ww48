import { ApiError } from "@/lib/http/api-error";
import type { AppRole, SessionUser } from "@/lib/types/auth";

/**
 * This file performs centralized role checks after authentication succeeds.
 * What calls it: route handlers and service-layer workflows that need elevated permissions.
 * What it calls: the shared ApiError contract.
 * A junior engineer would likely get this wrong by checking only in the UI,
 * which does nothing to stop direct API access.
 */
export function withRole(user: SessionUser, allowedRoles: AppRole[]) {
  if (!allowedRoles.includes(user.role)) {
    // ⚠️ SENIOR NOTE: centralizing elevated-role checks keeps route handlers from
    // drifting into inconsistent ad hoc role comparisons.
    throw new ApiError("You do not have permission to perform this action.", 403, "FORBIDDEN");
  }

  return user;
}
