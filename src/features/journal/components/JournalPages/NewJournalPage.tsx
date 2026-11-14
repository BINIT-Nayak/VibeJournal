"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JournalEditor } from "../JournalEditor/JournalEditor";
import { createJournalEntry } from "../../api-client";
import type { JournalCreateInput } from "../../schemas";
import { createLocalEntry, syncLocalEntry } from "../../offline/entries";
import { LocalEntries } from "../../offline/LocalEntries";

export function NewJournalPage({ userId }: { userId: string }) {
  const router = useRouter();
  const savedId = useRef<string>(null);
  const serverOnly = useRef(false);
  const [saved, setSaved] = useState(false);
  const [generation, setGeneration] = useState(0);
  async function save(values: JournalCreateInput) {
    try {
      const entry = await createLocalEntry(userId, values);
      savedId.current = entry.id;
      serverOnly.current = false;
    } catch {
      if (!navigator.onLine)
        throw new Error(
          "Local storage is unavailable. Keep this page open and reconnect before saving."
        );
      // Lack of browser storage must not prevent a normal online save.
      const { entry } = await createJournalEntry(values);
      savedId.current = entry.id;
      serverOnly.current = true;
    }
  }
  return (
    <>
      <LocalEntries userId={userId} />
      {saved ? (
        <section aria-label="Local save confirmation">
          <p role="status">
            Your entry is saved on this device. Check its sync status above before closing or
            clearing browser data.
          </p>
          <button
            type="button"
            onClick={() => {
              setGeneration((value) => value + 1);
              setSaved(false);
            }}
          >
            Write another entry
          </button>
        </section>
      ) : (
        <JournalEditor
          key={`${userId}:${generation}`}
          userId={userId}
          onSaved={() => {
            if (serverOnly.current) {
              router.replace(`/journal/${encodeURIComponent(savedId.current!)}?created=1`);
              return;
            }
            setSaved(true);
            // Local commit finishes first: an offline or slow connection never holds
            // the editor hostage. Pending entries also resume on reconnection.
            void syncLocalEntry(userId, savedId.current!).catch(() => {});
          }}
          onSave={save}
          onCancel={() => router.push("/journal")}
        />
      )}
    </>
  );
}
