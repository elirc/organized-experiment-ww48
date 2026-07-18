import type { SessionUser } from "@/lib/types/auth";

/**
 * This file centralizes role capabilities and lead ownership checks.
 * What calls it: middleware guards and service-layer authorization rules.
 * What it calls: the shared session-user contract.
 * A junior engineer would likely get this wrong by scattering permission checks
 * inside React components, which hides the real security boundary from reviewers.
 */
export const rolePermissions = {
  ADMIN: {
    viewAllLeads: true,
    createLead: true,
    editAnyLead: true,
    reassignLead: true,
    manageAllFollowUps: true,
  },
  MANAGER: {
    viewAllLeads: true,
    createLead: true,
    editAnyLead: true,
    reassignLead: true,
    manageAllFollowUps: true,
  },
  REP: {
    viewAllLeads: false,
    createLead: true,
    editAnyLead: false,
    reassignLead: false,
    manageAllFollowUps: false,
  },
} as const;

export type Permission = keyof (typeof rolePermissions)["ADMIN"];

export function hasPermission(user: SessionUser, permission: Permission) {
  return rolePermissions[user.role][permission];
}

export function canAccessLead(user: SessionUser, ownerId: string) {
  // ⚠️ SENIOR NOTE: child resources inherit lead visibility, so if this helper
  // is too loose the bug propagates into notes, follow-ups, and timelines.
  return hasPermission(user, "viewAllLeads") || user.id === ownerId;
}

export function canEditLead(user: SessionUser, ownerId: string) {
  return hasPermission(user, "editAnyLead") || user.id === ownerId;
}

export function canReassignLead(user: SessionUser) {
  return hasPermission(user, "reassignLead");
}

export function canManageFollowUp(user: SessionUser, ownerId: string) {
  return hasPermission(user, "manageAllFollowUps") || user.id === ownerId;
}
