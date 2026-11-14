"use client";
import { useState } from "react";
import type { JournalCreateInput } from "../schemas";
import { loadConflict, resolveConflict, type ConflictReview } from "./conflicts";

function Version({ values }: { values: JournalCreateInput }) {
  const context = [
    ["Mood", values.moodScore],
    ["Feeling", values.mood],
    ["Energy", values.energyScore],
    ["Sleep hours", values.sleepHours],
    ["Exercised", values.exercised == null ? null : values.exercised ? "Yes" : "No"],
    ["Social score", values.socialScore],
    ["Tags", values.tags?.join(", ") || null],
  ];
  return (
    <>
      <h5>{values.title || "Untitled reflection"}</h5>
      <p style={{ whiteSpace: "pre-wrap" }}>{values.content}</p>
      <dl>
        {context.map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{value ?? "Not recorded"}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
export function ConflictResolver({ userId, entryId }: { userId: string; entryId: string }) {
  const [review, setReview] = useState<ConflictReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setReview(await loadConflict(userId, entryId));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the comparison.");
    } finally {
      setBusy(false);
    }
  }
  async function choose(choice: "server" | "local") {
    if (!review || busy) return;
    const prompt =
      choice === "server"
        ? "Discard all queued changes for this entry and keep the server version?"
        : review.local.deleted
          ? "Delete the server version shown here? This deletion cannot be undone once synced."
          : review.server
            ? "Replace the server version shown here with your local version?"
            : "Save your local version as a new journal entry?";
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError("");
    try {
      await resolveConflict(review, choice);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not resolve this conflict.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Resolve journal conflict" aria-busy={busy}>
      <p role="alert">
        Conflict — your local changes are paused. Nothing will overwrite the server until you
        choose.
      </p>
      <button type="button" disabled={busy} onClick={() => void load()}>
        {review ? "Reload comparison" : "Review conflict"}
      </button>
      {busy && <p role="status">Checking versions…</p>}
      {error && <p role="alert">{error}</p>}
      {review && (
        <>
          <section aria-label="Your local version">
            <h4>Your local version</h4>
            {review.local.deleted && <p>You queued deletion of this entry.</p>}
            <Version values={review.local.values} />
          </section>
          <section aria-label="Current server version">
            <h4>Current server version</h4>
            {review.server ? (
              <>
                <p>
                  Updated:{" "}
                  <time dateTime={review.server.updatedAt}>
                    {new Date(review.server.updatedAt).toLocaleString()}
                  </time>
                </p>
                <Version values={review.server.values} />
              </>
            ) : (
              <p>This entry no longer exists or is no longer accessible on the server.</p>
            )}
          </section>
          <p>
            Your choice replaces all queued changes for this entry. If the server changes again,
            you’ll be asked to review again.
          </p>
          <button type="button" disabled={busy} onClick={() => void choose("server")}>
            {review.server ? "Keep server version" : "Accept server deletion"}
          </button>
          {(!review.local.deleted || review.server) && (
            <button type="button" disabled={busy} onClick={() => void choose("local")}>
              {!review.server
                ? "Save local version as new entry"
                : review.local.deleted
                  ? "Confirm deletion of server version"
                  : "Keep my version"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
