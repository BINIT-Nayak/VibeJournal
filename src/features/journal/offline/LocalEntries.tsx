"use client";

import { JournalEditor } from "../components/JournalEditor/JournalEditor";
import { enqueueMutation } from "../sync/queue";
import styles from "./LocalEntries.module.css";
import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { journalLocalDb, type LocalJournalEntry } from "../drafts/storage";
import { syncLocalEntry } from "./entries";

export function LocalEntries({ userId }: { userId: string }) {
  const [editing, setEditing] = useState<LocalJournalEntry | null>(null);
  const [entries, setEntries] = useState<LocalJournalEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    const connectivity = () => setOnline(navigator.onLine);
    const subscription = liveQuery(() =>
      journalLocalDb().localEntries.where("userId").equals(userId).toArray()
    ).subscribe({
      next: (rows) => {
        if (active) setEntries(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        if (rows.some((row) => row.status === "synced")) {
          void queryClient.invalidateQueries({ queryKey: ["journal-history", userId] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
          void queryClient.invalidateQueries({ queryKey: ["analytics", userId] });
        }
      },
      error: () => {
        if (active) setError("Local storage is unavailable.");
      },
    });
    connectivity();
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    };
  }, [userId, queryClient]);
  if (!entries.length && !error && online) return null;
  return (
    <section className={styles.panel} aria-label="Entries on this device">
      <h2>Entries on this device</h2>
      {!online && <p role="status">You’re offline. New entries can be saved on this device.</p>}
      {error && <p role="alert">{error}</p>}
      {editing && editing.userId === userId && (
        <JournalEditor
          key={editing.id}
          userId={userId}
          entryId={editing.id}
          mode="edit"
          baseUpdatedAt={editing.serverUpdatedAt}
          initialValues={editing.values}
          onCancel={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onSave={async (values, version) => {
            await enqueueMutation(userId, editing.id, "update", values, version);
          }}
        />
      )}
      {entries
        .filter((entry) => entry.userId === userId)
        .map((entry) => (
          <article key={entry.id}>
            <h3>{entry.values.title || "Untitled reflection"}</h3>
            {entry.deleted && (
              <p>
                {entry.status === "synced"
                  ? "Deletion synced."
                  : "Deletion queued — the server entry remains until sync completes."}
              </p>
            )}
            <p role="status">
              {entry.status === "synced"
                ? entry.deleted
                  ? "Synced — deletion confirmed."
                  : "Synced — saved to your journal."
                : entry.status === "syncing"
                  ? "Syncing — local copy retained until confirmed."
                  : entry.status === "failed"
                    ? "Failed to sync — saved on this device only."
                    : "Pending — saved on this device only."}
            </p>
            <details>
              <summary>Read local entry</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{entry.values.content}</p>
              <p>Mood: {entry.values.moodScore}/10</p>
            </details>
            {entry.error && <p role="alert">{entry.error}</p>}
            {entry.error && entry.serverUpdatedAt && (
              <a href={`/journal/${entry.id}`}>Review server entry</a>
            )}
            {!entry.deleted && (
              <div>
                <button type="button" onClick={() => setEditing(entry)}>
                  Edit local entry
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Queue permanent deletion of this entry when connected?"))
                      return;
                    try {
                      await enqueueMutation(
                        userId,
                        entry.id,
                        "delete",
                        entry.values,
                        entry.serverUpdatedAt
                      );
                    } catch (failure) {
                      setError(
                        failure instanceof Error ? failure.message : "Could not queue deletion."
                      );
                    }
                  }}
                >
                  Queue deletion
                </button>
              </div>
            )}
            {entry.status === "synced" && !entry.deleted ? (
              <a href={`/journal/${entry.id}`}>View saved entry</a>
            ) : entry.status !== "synced" ? (
              <button
                type="button"
                disabled={
                  !online || (entry.status === "syncing" && (entry.leaseUntil ?? 0) > Date.now())
                }
                onClick={() =>
                  void syncLocalEntry(userId, entry.id).catch(() =>
                    setError("Could not update local sync status. Your local copy is retained.")
                  )
                }
              >
                Retry sync
              </button>
            ) : null}
          </article>
        ))}
    </section>
  );
}
