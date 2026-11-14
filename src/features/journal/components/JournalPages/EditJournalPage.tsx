"use client";
import { liveQuery } from "dexie";
import { journalLocalDb } from "../../drafts/storage";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalEntryDto } from "../../api-types";
import { JournalEditor } from "../JournalEditor/JournalEditor";
import { enqueueMutation } from "../../sync/queue";
import { LocalEntries } from "../../offline/LocalEntries";

export function EditJournalPage({ entry, userId }: { entry: JournalEntryDto; userId: string }) {
  const router = useRouter();
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    if (!queued) return;
    const subscription = liveQuery(() => journalLocalDb().localEntries.get(entry.id)).subscribe(
      (row) => {
        if (row?.userId === userId && !row.deleted && row.status === "synced")
          window.location.replace(`/journal/${entry.id}`);
      }
    );
    return () => subscription.unsubscribe();
  }, [queued, entry.id, userId]);
  return (
    <>
      <LocalEntries userId={userId} />
      {queued ? (
        <section aria-label="Queued edit">
          <p role="status">
            Changes saved on this device and queued for sync. The server entry changes only after
            sync succeeds.
          </p>
          <a href={`/journal/${entry.id}`}>View server entry</a>
        </section>
      ) : (
        <JournalEditor
          key={`${userId}:${entry.id}`}
          userId={userId}
          entryId={entry.id}
          baseUpdatedAt={entry.updatedAt}
          mode="edit"
          initialValues={{
            title: entry.title,
            content: entry.content,
            mood: entry.mood,
            moodScore: entry.moodScore,
            energyScore: entry.energyScore,
            sleepHours: entry.sleepHours,
            exercised: entry.exercised,
            socialScore: entry.socialScore,
            tags: entry.tags,
          }}
          onCancel={() => router.push("/journal")}
          onSaved={() => setQueued(true)}
          onSave={async (values, baseVersion) => {
            await enqueueMutation(
              userId,
              entry.id,
              "update",
              values,
              baseVersion ?? entry.updatedAt
            );
          }}
        />
      )}
    </>
  );
}
