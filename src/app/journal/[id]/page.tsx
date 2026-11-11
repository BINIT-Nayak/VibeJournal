import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getEntry, JournalNotFoundError } from "@/server/journal/service";
import { JournalEntryDetail } from "@/features/journal/components/JournalPages/JournalEntryDetail";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    const entry = await getEntry(user, (await params).id);
    return (
      <JournalEntryDetail
        entry={{ ...entry, sleepHours: entry.sleepHours ?? undefined }}
        created={(await searchParams).created === "1"}
      />
    );
  } catch (error) {
    if (error instanceof JournalNotFoundError) notFound();
    throw error;
  }
}
