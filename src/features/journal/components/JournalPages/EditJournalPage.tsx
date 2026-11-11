"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalEntryDto } from "../../api-types";
import { updateJournalEntry } from "../../api-client";
import { JournalEditor } from "../JournalEditor/JournalEditor";

export function EditJournalPage({ entry }: { entry: JournalEntryDto }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <JournalEditor
      mode="edit"
      pending={pending}
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
      onSave={async (values) => {
        await updateJournalEntry(entry.id, values);
        setPending(true);
        // A fresh server request avoids reopening a cached detail from before the edit.
        window.location.replace(`/journal/${encodeURIComponent(entry.id)}`);
      }}
    />
  );
}
