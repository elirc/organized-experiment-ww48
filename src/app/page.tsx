import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { requirePageSession } from "@/lib/auth/session";

export default async function Home() {
  const viewer = await requirePageSession();
  return <DashboardPage viewer={viewer} />;
}
