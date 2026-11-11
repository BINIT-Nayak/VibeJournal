import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { JournalHistory } from "@/features/journal/components/JournalPages/JournalHistory";

export const metadata = { title: "Journal · VibeJournal" };
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <JournalHistory userId={user.id} deleted={(await searchParams).deleted === "1"} />;
}
