"use client";
import { z } from "zod";
import { journalLocalDb, type LocalJournalEntry } from "../drafts/storage";
import { journalCreateSchema, type JournalCreateInput } from "../schemas";

export type ServerSnapshot = { values: JournalCreateInput; updatedAt: string } | null;
export type ConflictReview = {
  userId: string;
  entryId: string;
  key: string;
  pendingKeys: string[];
  local: LocalJournalEntry;
  server: ServerSnapshot;
};
async function readServer(userId: string, entryId: string): Promise<ServerSnapshot> {
  const response = await fetch(`/api/journal/${encodeURIComponent(entryId)}`, {
    headers: { "X-Local-Journal-Owner": userId },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.error?.message || "Could not load the server version. Reconnect and try again."
    );
  if (body?.entry?.id !== entryId) throw new Error("Unexpected server entry.");
  return {
    values: journalCreateSchema.parse(body.entry),
    updatedAt: z.iso.datetime().parse(body.entry.updatedAt),
  };
}
export async function loadConflict(userId: string, entryId: string): Promise<ConflictReview> {
  const server = await readServer(userId, entryId);
  const db = journalLocalDb();
  return db.transaction("r", db.localEntries, db.mutations, async () => {
    const local = await db.localEntries.get(entryId);
    const rows = (
      await db.mutations.where("[userId+entryId]").equals([userId, entryId]).sortBy("seq")
    ).filter((row) => row.status !== "synced" && row.status !== "discarded");
    if (!local || local.userId !== userId || rows[0]?.status !== "conflict")
      throw new Error("This conflict has already changed. Refresh the local entries list.");
    return {
      userId,
      entryId,
      key: rows[0].key,
      pendingKeys: rows.map((row) => row.key),
      local,
      server,
    };
  });
}

export async function resolveConflict(review: ConflictReview, choice: "server" | "local") {
  // Recheck the version shown in the review. A subsequent race is also guarded
  // by the version in the new mutation; no force-write path is introduced.
  const latest = await readServer(review.userId, review.entryId);
  if (latest?.updatedAt !== review.server?.updatedAt)
    throw new Error("The server changed again. Reload the comparison before choosing.");
  const db = journalLocalDb();
  await db.transaction("rw", db.localEntries, db.mutations, async () => {
    const local = await db.localEntries.get(review.entryId);
    const pending = (
      await db.mutations
        .where("[userId+entryId]")
        .equals([review.userId, review.entryId])
        .sortBy("seq")
    ).filter((row) => row.status !== "synced" && row.status !== "discarded");
    if (
      !local ||
      local.userId !== review.userId ||
      pending[0]?.status !== "conflict" ||
      pending[0].key !== review.key ||
      JSON.stringify(pending.map((row) => row.key)) !== JSON.stringify(review.pendingKeys) ||
      JSON.stringify(local.values) !== JSON.stringify(review.local.values) ||
      local.deleted !== review.local.deleted
    )
      throw new Error(
        "The local changes were resolved or changed in another tab. Reload the comparison."
      );
    for (const row of pending)
      await db.mutations.update(row.seq!, { status: "discarded", retryable: false });
    if (choice === "server" || (local.deleted && !latest)) {
      await db.localEntries.put({
        ...local,
        values: latest?.values ?? local.values,
        serverUpdatedAt: latest?.updatedAt,
        deleted: !latest,
        status: "synced",
        error: undefined,
      });
      return;
    }
    // A remotely deleted entry is recovered as a NEW journal, never resurrected
    // under its old ID (whose durable receipts may represent a completed delete).
    const entryId = latest ? review.entryId : crypto.randomUUID();
    if (!latest)
      await db.localEntries.update(review.entryId, {
        deleted: true,
        status: "synced",
        error: undefined,
      });
    await db.localEntries.put({
      ...local,
      id: entryId,
      deleted: latest ? local.deleted : false,
      status: "pending",
      serverUpdatedAt: latest?.updatedAt,
      error: undefined,
    });
    await db.mutations.add({
      key: crypto.randomUUID(),
      userId: review.userId,
      entryId,
      kind: !latest ? "create" : local.deleted ? "delete" : "update",
      values: local.deleted && latest ? undefined : local.values,
      expectedUpdatedAt: latest?.updatedAt,
      status: "pending",
      attempts: 0,
      retryable: true,
      nextAttemptAt: 0,
    });
  });
  window.dispatchEvent(new Event("vibejournal-sync-queued"));
  window.dispatchEvent(new Event("vibejournal-synced"));
}
