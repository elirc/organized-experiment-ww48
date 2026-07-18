import { LeadDetailPage } from "@/components/leads/lead-detail-page";
import { requirePageSession } from "@/lib/auth/session";
import { getAssignableUsersForViewer } from "@/services/dashboardService";

/**
 * This file renders the lead detail workspace for an authenticated user.
 * What calls it: the browser requesting /leads/[leadId].
 * What it calls: session helpers, userRepository, and the lead detail page component.
 * A junior engineer would likely get this wrong by fetching assignment options in
 * the client with no server-side auth gate, which widens the attack surface.
 */
export default async function LeadPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const viewer = await requirePageSession();
  const { leadId } = await params;
  const assignableUsers = (await getAssignableUsersForViewer(viewer)).map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
  }));

  return <LeadDetailPage leadId={leadId} viewer={viewer} assignableUsers={assignableUsers} />;
}
