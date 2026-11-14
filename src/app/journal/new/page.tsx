import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { NewJournalPage } from "@/features/journal/components/JournalPages/NewJournalPage";

export const metadata = { title: "New entry · VibeJournal" };
export default async function NewEntryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NewJournalPage userId={user.id} />;
}
