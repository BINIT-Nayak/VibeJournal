import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";

export const metadata = { title: "Analytics · VibeJournal" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AnalyticsPage userId={user.id} />;
}
