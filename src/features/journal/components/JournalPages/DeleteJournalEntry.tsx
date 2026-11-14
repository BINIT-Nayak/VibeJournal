"use client";
import { containDialogFocus } from "@/components/ui/dialog-focus";

import { useEffect, useId, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { journalLocalDb } from "../../drafts/storage";
import { enqueueMutation } from "../../sync/queue";
import { LocalEntries } from "../../offline/LocalEntries";
import type { JournalEntryDto } from "../../api-types";
import styles from "./JournalEntryDetail.module.css";

export function DeleteJournalEntry({ entry, userId }: { entry: JournalEntryDto; userId: string }) {
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const [queued, setQueued] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (lock.current || !dialog.current?.open) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await enqueueMutation(userId, entry.id, "delete", entry, entry.updatedAt);
      dialog.current?.close();
      setQueued(true);
      setPending(false);
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

  useEffect(() => {
    if (!queued) return;
    const subscription = liveQuery(() => journalLocalDb().localEntries.get(entry.id)).subscribe(
      (row) => {
        if (row?.userId === userId && row.status === "synced")
          window.location.replace(row.deleted ? "/journal?deleted=1" : `/journal/${entry.id}`);
      }
    );
    return () => subscription.unsubscribe();
  }, [queued, entry.id, userId]);

  function open() {
    if (lock.current) return;
    setError("");
    dialog.current?.showModal();
    cancel.current?.focus();
  }
  function close() {
    if (!lock.current) dialog.current?.close();
  }
  if (queued)
    return (
      <>
        <p role="status">
          Deletion saved locally and queued for sync. It is not deleted on the server until
          confirmed.
        </p>
        <LocalEntries userId={userId} />
      </>
    );
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
        onKeyDown={containDialogFocus}
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
          This queues permanent deletion of the journal entry and its tags. It will be deleted when
          sync succeeds. You cannot undo a completed deletion.
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
