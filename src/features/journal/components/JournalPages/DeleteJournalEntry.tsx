"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { JournalHistoryResponse } from "../../api-types";
import styles from "./JournalEntryDetail.module.css";

export function DeleteJournalEntry({ id }: { id: string }) {
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (lock.current || !dialog.current?.open) return;
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
      // Stop an older request from restoring the removed entry, update every
      // cached history page, and mark those pages stale before navigation.
      await queryClient.cancelQueries({ queryKey: ["journal-history"] });
      queryClient.setQueriesData<JournalHistoryResponse>(
        { queryKey: ["journal-history"] },
        (current) =>
          current
            ? { ...current, entries: current.entries.filter((entry) => entry.id !== id) }
            : current
      );
      await queryClient.invalidateQueries({ queryKey: ["journal-history"], refetchType: "none" });
      // A fresh route also clears any cached server-rendered detail after deletion.
      window.location.replace("/journal?deleted=1");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete your entry.");
      lock.current = false;
      setPending(false);
    }
  }
  useEffect(() => {
    if (dialog.current?.open) {
      if (pending) dialog.current.focus();
      else cancel.current?.focus();
    }
  }, [pending]);

  function open() {
    if (lock.current) return;
    setError("");
    dialog.current?.showModal();
    cancel.current?.focus();
  }
  function close() {
    if (!lock.current) dialog.current?.close();
  }
  return (
    <div className={styles.deleteAction}>
      <button
        ref={trigger}
        className={styles.deleteButton}
        type="button"
        disabled={pending}
        onClick={open}
      >
        Delete entry
      </button>
      <dialog
        ref={dialog}
        className={styles.confirmDialog}
        aria-labelledby={`${labelId}-title`}
        aria-describedby={`${labelId}-description`}
        aria-busy={pending}
        tabIndex={-1}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={`${labelId}-title`}>Delete this entry?</h2>
        <p id={`${labelId}-description`}>
          This will permanently delete this journal entry and its tags. You cannot undo this action.
        </p>
        {error && (
          <p className={styles.deleteError} role="alert">
            {error}
          </p>
        )}
        <p role="status">
          {pending ? "Deleting your entry…" : "Your entry will stay unless you confirm deletion."}
        </p>
        <div className={styles.dialogActions}>
          <button ref={cancel} type="button" disabled={pending} onClick={close}>
            Cancel
          </button>
          <button
            className={styles.confirmDelete}
            type="button"
            disabled={pending}
            onClick={() => void remove()}
          >
            {pending ? "Deleting…" : "Permanently delete entry"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
