import { redirect } from "next/navigation";
import { VibeJournalApp } from "@/features/journal/VibeJournalApp";
import { getCurrentUser } from "@/server/auth/session";

export default async function DashboardPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return <VibeJournalApp />;
}
