import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { NewJournalPage } from "@/features/journal/components/JournalPages/NewJournalPage";

export const metadata = { title: "New entry · VibeJournal" };
export default async function NewEntryPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return <NewJournalPage />;
}
