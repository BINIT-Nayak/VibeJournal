"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalEntryDto } from "../../api-types";
import { updateJournalEntry, JournalSaveError } from "../../api-client";
import { JournalEditor } from "../JournalEditor/JournalEditor";

export function EditJournalPage({ entry }: { entry: JournalEntryDto }) {
  const router = useRouter();
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      {conflict && (
        <section aria-label="Resolve edit conflict">
          <p>A newer version is available. Your unsaved changes remain in the editor below.</p>
          <a href={`/journal/${entry.id}`} target="_blank" rel="noopener noreferrer">
            View latest entry in a new tab
          </a>
          <p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Discard this draft and load the latest saved version?"))
                  window.location.reload();
              }}
            >
              Discard draft and reload latest
            </button>
          </p>
        </section>
      )}
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
          try {
            await updateJournalEntry(entry.id, values, entry.updatedAt);
          } catch (error) {
            if (error instanceof JournalSaveError && error.code === "CONFLICT") setConflict(true);
            throw error;
          }
          setPending(true);
          // A fresh server request avoids reopening a cached detail from before the edit.
          window.location.replace(`/journal/${encodeURIComponent(entry.id)}`);
        }}
      />
    </>
  );
}
