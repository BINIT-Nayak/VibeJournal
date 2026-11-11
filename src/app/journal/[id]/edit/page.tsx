import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getEntry, JournalNotFoundError } from "@/server/journal/service";
import { EditJournalPage } from "@/features/journal/components/JournalPages/EditJournalPage";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    return <EditJournalPage entry={await getEntry(user, (await params).id, true)} />;
  } catch (error) {
    if (error instanceof JournalNotFoundError) notFound();
    throw error;
  }
}
