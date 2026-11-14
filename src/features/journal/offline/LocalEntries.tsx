"use client";

import styles from "./LocalEntries.module.css";
import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { journalLocalDb, type LocalJournalEntry } from "../drafts/storage";
import { syncLocalEntry } from "./entries";

export function LocalEntries({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<LocalJournalEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    const run = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      try {
        const rows = await journalLocalDb().localEntries.where("userId").equals(userId).toArray();
        for (const row of rows) {
          if (!active) break;
          if (
            row.status === "pending" ||
            (row.status === "syncing" && (row.leaseUntil ?? 0) <= Date.now())
          ) {
            await syncLocalEntry(userId, row.id);
          }
        }
      } catch {
        if (active)
          setError("Local entries could not be accessed. Your server journal is still available.");
      }
    };
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
    void run();
    const timer = setInterval(() => void run(), 60_000);
    window.addEventListener("online", run);
    window.addEventListener("offline", run);
    return () => {
      active = false;
      subscription.unsubscribe();
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("offline", run);
    };
  }, [userId, queryClient]);
  if (!entries.length && !error && online) return null;
  return (
    <section className={styles.panel} aria-label="Entries on this device">
      <h2>Entries on this device</h2>
      {!online && <p role="status">You’re offline. New entries can be saved on this device.</p>}
      {error && <p role="alert">{error}</p>}
      {entries
        .filter((entry) => entry.userId === userId)
        .map((entry) => (
          <article key={entry.id}>
            <h3>{entry.values.title || "Untitled reflection"}</h3>
            <p role="status">
              {entry.status === "synced"
                ? "Synced — saved to your journal."
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
            {entry.error && <p>{entry.error}</p>}
            {entry.status === "synced" ? (
              <a href={`/journal/${entry.id}`}>View saved entry</a>
            ) : (
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
            )}
          </article>
        ))}
    </section>
  );
}
