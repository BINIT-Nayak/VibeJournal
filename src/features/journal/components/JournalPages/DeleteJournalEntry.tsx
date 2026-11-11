"use client";

import { useRef, useState } from "react";
import styles from "./JournalEntryDetail.module.css";

export function DeleteJournalEntry({ id }: { id: string }) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (
      lock.current ||
      !window.confirm("Delete this journal entry permanently? This cannot be undone.")
    )
      return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      let response: Response;
      try {
        response = await fetch(`/api/journal/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        throw new Error("We couldn't connect. Check your connection and try again.");
      }
      if (response.status !== 204) {
        const result = await response.json().catch(() => null);
        throw new Error(
          response.status === 401
            ? "Your session has expired. Sign in again to delete this entry."
            : response.status === 404
              ? "This entry is no longer available. Return to your journal."
              : (result?.error?.message ?? "Could not delete your entry. Please try again.")
        );
      }
      // Reload history so the deleted entry cannot reappear from a client cache.
      window.location.replace("/journal?deleted=1");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete your entry.");
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div className={styles.deleteAction}>
      <button
        className={styles.deleteButton}
        type="button"
        disabled={pending}
        onClick={() => void remove()}
      >
        {pending ? "Deleting…" : "Delete entry"}
      </button>
      {pending && <p role="status">Deleting your entry…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
