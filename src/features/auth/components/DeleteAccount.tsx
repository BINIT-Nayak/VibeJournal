"use client";
import { containDialogFocus } from "@/components/ui/dialog-focus";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearLocalAccountData } from "@/features/journal/drafts/storage";
import styles from "@/features/journal/components/JournalPages/JournalEntryDetail.module.css";

export function DeleteAccount({ userId }: { userId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const client = useQueryClient();
  const [method, setMethod] = useState<"password" | "google" | null>(null);
  const [verified, setVerified] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  async function open() {
    setPassword("");
    setConfirmation("");
    setError("");
    setMethod(null);
    dialog.current?.showModal();
    try {
      const response = await fetch("/api/account/reauth", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not verify your account.");
      setMethod(data.method);
      setVerified(data.verified);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load verification. Close and try again."
      );
    }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("deleteAccount") === "1") {
      void open();
      const url = new URL(window.location.href);
      url.searchParams.delete("deleteAccount");
      window.history.replaceState(null, "", url);
    }
  }, []);
  function close() {
    if (lock.current || deleted) return;
    setPassword("");
    setConfirmation("");
    dialog.current?.close();
  }
  async function verifyGoogle() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/account/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Verification failed.");
      window.location.assign(data.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Verification failed.");
      lock.current = false;
      setPending(false);
    }
  }
  async function finishLocally() {
    client.clear();
    await clearLocalAccountData(userId);
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("vibejournal-account") : null;
    channel?.postMessage({ type: "deleted", userId });
    channel?.close();
    window.location.replace("/login?accountDeleted=1");
  }
  async function remove() {
    if (lock.current || confirmation !== "DELETE") return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, ...(method === "password" ? { password } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "REAUTH_REQUIRED" && method === "google") setVerified(false);
        throw new Error(data.error ?? "Deletion failed. Please try again.");
      }
      setDeleted(true);
      setPassword("");
      try {
        await finishLocally();
      } catch {
        setError(
          "Your server account was deleted, but this browser's local drafts could not be cleared. Retry cleanup, or clear this site's browser data."
        );
      }
    } catch (error) {
      setPassword("");
      setError(error instanceof Error ? error.message : "Deletion failed. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div className={styles.deleteAction}>
      <button
        type="button"
        ref={trigger}
        className={styles.deleteButton}
        onClick={() => void open()}
      >
        Delete account permanently
      </button>
      <dialog
        onKeyDown={containDialogFocus}
        ref={dialog}
        tabIndex={-1}
        className={styles.confirmDialog}
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        aria-busy={pending}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id="delete-account-title">
          {deleted ? "Account deleted" : "Permanently delete your account?"}
        </h2>
        <p id="delete-account-description">
          This deletes your journals, tags, AI analyses, music preferences and history, settings,
          and all sessions. You cannot undo this. Download your data first if you want a copy.
        </p>
        <p>
          Local drafts on this browser will also be removed. Offline copies on other devices and
          previously downloaded files must be removed there. Existing backups expire under the
          hosting retention policy.
        </p>
        {!deleted && (
          <>
            {method === null && !error && <p role="status">Loading identity verification…</p>}
            {method === "password" && (
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={pending}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={128}
                />
              </label>
            )}
            {method === "google" &&
              (verified ? (
                <p>Google identity verified. Confirm deletion below within five minutes.</p>
              ) : (
                <button type="button" onClick={() => void verifyGoogle()} disabled={pending}>
                  Re-authenticate with Google
                </button>
              ))}
            <label>
              Type DELETE to confirm
              <input
                value={confirmation}
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className={styles.deleteError}>
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          {!deleted && (
            <button type="button" disabled={pending} onClick={close} autoFocus>
              Cancel
            </button>
          )}
          {deleted ? (
            <button
              type="button"
              onClick={() =>
                void finishLocally().catch(() =>
                  setError("Clear this site's browser data to remove remaining local drafts.")
                )
              }
            >
              Retry local cleanup
            </button>
          ) : (
            <button
              type="button"
              className={styles.confirmDelete}
              disabled={
                pending ||
                confirmation !== "DELETE" ||
                !method ||
                (method === "password" ? !password : !verified)
              }
              onClick={() => void remove()}
            >
              {pending ? "Working…" : "Permanently delete my account"}
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}
