"use client";

import { journalLocalDb, type LocalJournalEntry } from "../drafts/storage";
import { journalCreateSchema, type JournalCreateInput } from "../schemas";

export async function createLocalEntry(
  userId: string,
  values: JournalCreateInput,
  id = crypto.randomUUID()
) {
  const entry: LocalJournalEntry = {
    id,
    userId,
    values: journalCreateSchema.parse(values),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await journalLocalDb().localEntries.add(entry);
  return entry;
}

// Lease claims are transactional across tabs. Expired claims can be retried after
// a closed/crashed tab; the same ID is used for every server attempt.
export async function syncLocalEntry(userId: string, id: string) {
  if (!navigator.onLine) return;
  const db = journalLocalDb();
  const attempt = crypto.randomUUID();
  const entry = await db.transaction("rw", db.localEntries, async () => {
    const row = await db.localEntries.get(id);
    if (
      !row ||
      row.userId !== userId ||
      row.status === "synced" ||
      (row.status === "syncing" && (row.leaseUntil ?? 0) > Date.now())
    )
      return null;
    await db.localEntries.update(id, {
      status: "syncing",
      attempt,
      leaseUntil: Date.now() + 60_000,
      error: undefined,
    });
    return row;
  });
  if (!entry) return;
  let status: LocalJournalEntry["status"] = "synced";
  let message: string | undefined;
  try {
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Journal-Owner": userId },
      body: JSON.stringify({ ...entry.values, clientEntryId: id }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.entry?.id !== id) {
      throw new Error(
        result?.error?.message || "Could not confirm the upload. Retry when you are connected."
      );
    }
  } catch (error) {
    status = navigator.onLine ? "failed" : "pending";
    message =
      error instanceof Error ? error.message : "Upload failed. Your entry is still saved locally.";
  }
  await db.transaction("rw", db.localEntries, async () => {
    const row = await db.localEntries.get(id);
    if (row?.userId === userId && row.attempt === attempt) {
      await db.localEntries.update(id, { status, error: message, leaseUntil: undefined });
    }
  });
}
