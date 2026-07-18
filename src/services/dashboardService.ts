import { db } from "@/lib/db";
import { canReassignLead, hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/types/auth";
import type { LeadFilters } from "@/repositories/leadRepository";
import { listUpcomingFollowUps } from "@/repositories/followUpRepository";
import { getLeadStageCounts, listLeads } from "@/repositories/leadRepository";
import { listAssignableUsers } from "@/repositories/userRepository";

/**
 * This file composes the dashboard read model used by the main CRM page.
 * What calls it: src/app/api/dashboard/route.ts and authenticated server pages.
 * What it calls: lead, follow-up, and user repositories.
 * A junior engineer would likely get this wrong by making the dashboard page
 * call three unrelated endpoints instead of assembling a coherent read model.
 */
function getLeadVisibility(user: SessionUser) {
  return hasPermission(user, "viewAllLeads") ? {} : { ownerId: user.id };
}

export async function getAssignableUsersForViewer(user: SessionUser) {
  const users = await listAssignableUsers(db);

  if (canReassignLead(user)) {
    return users;
  }

  // ⚠️ SENIOR NOTE: reps should not receive the full active-user roster in page
  // props or API responses; filtering here prevents an unnecessary data leak.
  return users.filter((candidate) => candidate.id === user.id);
}

export async function getDashboardData(user: SessionUser, filters: LeadFilters) {
  const visibility = getLeadVisibility(user);

  const [leads, counts, upcomingFollowUps, assignableUsers] = await Promise.all([
    listLeads(db, filters, visibility),
    getLeadStageCounts(db, { ownerId: filters.ownerId, search: filters.search }, visibility),
    listUpcomingFollowUps(db, visibility),
    getAssignableUsersForViewer(user),
  ]);

  return {
    viewer: user,
    filters,
    leads,
    counts,
    upcomingFollowUps,
    assignableUsers,
  };
}
