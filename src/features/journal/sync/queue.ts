"use client";
import {
  deletedLocalAccounts,
  journalLocalDb,
  type SyncMutationRecord,
  type LocalJournalEntry,
} from "../drafts/storage";
import { journalCreateSchema, type JournalCreateInput } from "../schemas";
import { journalMutationSchema, mutationResultSchema, type MutationResult } from "./schemas";

async function refreshStatus(userId: string, entryId: string) {
  const db = journalLocalDb();
  const rows = await db.mutations.where("[userId+entryId]").equals([userId, entryId]).sortBy("seq");
  const head = rows.find((row) => row.status !== "synced" && row.status !== "discarded");
  await db.localEntries.update(entryId, {
    status: head && head.status !== "discarded" ? head.status : "synced",
    error: head?.error,
    leaseUntil: head?.leaseUntil,
  });
}

export async function enqueueMutation(
  userId: string,
  entryId: string,
  kind: SyncMutationRecord["kind"],
  values: JournalCreateInput,
  expectedUpdatedAt?: string
) {
  if (deletedLocalAccounts.has(userId)) throw new Error("This account has been deleted.");
  const db = journalLocalDb();
  const valid = journalCreateSchema.parse(values);
  const key = crypto.randomUUID();
  await db.transaction("rw", db.localEntries, db.mutations, async () => {
    const existing = await db.localEntries.get(entryId);
    if (existing && existing.userId !== userId)
      throw new Error("This local entry belongs to another account.");
    const rows = await db.mutations
      .where("[userId+entryId]")
      .equals([userId, entryId])
      .sortBy("seq");
    if (rows.some((row) => row.status === "conflict"))
      throw new Error("Resolve the conflict before making more changes to this entry.");
    const previous = rows.filter((row) => row.status !== "discarded").at(-1);
    if (previous?.kind === "delete") throw new Error("Deletion is already queued for this entry.");
    const dependsOn = previous && previous.status !== "synced" ? previous.key : undefined;
    if (kind !== "create" && !dependsOn && !expectedUpdatedAt && !existing?.serverUpdatedAt)
      throw new Error(
        "Open the latest saved entry online before editing or deleting this local copy."
      );
    const local: LocalJournalEntry = {
      ...existing,
      id: entryId,
      userId,
      values: valid,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      status: "pending",
      deleted: kind === "delete",
      serverUpdatedAt: existing?.serverUpdatedAt ?? expectedUpdatedAt,
    };
    await db.localEntries.put(local);
    await db.mutations.add({
      key,
      userId,
      entryId,
      kind,
      values: kind === "delete" ? undefined : valid,
      expectedUpdatedAt: expectedUpdatedAt ?? existing?.serverUpdatedAt,
      dependsOn,
      status: "pending",
      attempts: 0,
      retryable: true,
      nextAttemptAt: 0,
    });
    await refreshStatus(userId, entryId);
  });
  window.dispatchEvent(new Event("vibejournal-sync-queued"));
  return key;
}

async function claim(userId: string, entryId?: string, retry = false) {
  if (deletedLocalAccounts.has(userId)) return;
  const db = journalLocalDb();
  return db.transaction("rw", db.mutations, db.localEntries, async () => {
    const rows = await db.mutations.where("userId").equals(userId).sortBy("seq");
    const seen = new Set<string>();
    for (const row of rows) {
      if (
        row.status === "synced" ||
        row.status === "discarded" ||
        (entryId && row.entryId !== entryId) ||
        seen.has(row.entryId)
      )
        continue;
      seen.add(row.entryId);
      if (row.status === "conflict") continue;
      if (row.status === "syncing" && (row.leaseUntil ?? 0) > Date.now()) continue;
      if (!retry && ((!row.retryable && row.status === "failed") || row.nextAttemptAt > Date.now()))
        continue;
      if (!row.payload) {
        const previous = row.dependsOn
          ? rows.find((item) => item.key === row.dependsOn)
          : undefined;
        if (row.dependsOn && previous?.status !== "synced") continue;
        const expected = previous?.result?.updatedAt ?? row.expectedUpdatedAt;
        const parsed = journalMutationSchema.safeParse({
          key: row.key,
          entryId: row.entryId,
          kind: row.kind,
          ...(row.kind === "delete" ? {} : { values: row.values }),
          ...(row.kind === "create" ? {} : { expectedUpdatedAt: expected }),
        });
        if (!parsed.success) {
          await db.mutations.update(row.seq!, {
            status: "failed",
            retryable: false,
            error:
              "This queued change needs a valid saved version. Review the latest entry online.",
          });
          await refreshStatus(userId, row.entryId);
          continue;
        }
        row.payload = parsed.data;
      }
      row.status = "syncing";
      row.attempt = crypto.randomUUID();
      row.leaseUntil = Date.now() + 60_000;
      row.attempts++;
      row.error = undefined;
      await db.mutations.put(row);
      await refreshStatus(userId, row.entryId);
      return row;
    }
    return null;
  });
}

export async function replayQueue(
  userId: string,
  options: { entryId?: string; retry?: boolean } = {}
) {
  // No React/network state is authoritative: each claim is persisted atomically
  // across tabs, and server receipts cover a crash after the remote commit.
  if (!navigator.onLine) return;
  let manual = options.retry ?? false;
  for (let count = 0; count < 100 && navigator.onLine; count++) {
    const row = await claim(userId, options.entryId, manual);
    manual = false;
    if (!row) return;
    let result: MutationResult | undefined;
    let error: string | undefined;
    let retryable = true;
    let conflictReason: "changed" | "missing" | undefined;
    let retryDelay = Math.min(300_000, 1000 * 2 ** Math.min(row.attempts, 8));
    try {
      const response = await fetch("/api/journal/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Local-Journal-Owner": userId },
        body: JSON.stringify(row.payload),
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409 && body?.error?.code === "VERSION_CONFLICT")
          conflictReason = "changed";
        if (response.status === 404 && row.kind !== "create") conflictReason = "missing";
        retryable = response.status >= 500 || response.status === 429 || response.status === 408;
        if (response.status === 429)
          retryDelay = Math.max(
            retryDelay,
            Number(response.headers.get("Retry-After") || 0) * 1000
          );
        throw new Error(
          body?.error?.message || "Upload could not be confirmed. Your change is saved locally."
        );
      }
      result = mutationResultSchema.parse(body?.result);
      if (result.entryId !== row.entryId)
        throw new Error("The server returned an unexpected entry.");
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not sync this change.";
    }
    const db = journalLocalDb();
    await db.transaction("rw", db.mutations, db.localEntries, async () => {
      const current = await db.mutations.get(row.seq!);
      if (current?.attempt !== row.attempt) return;
      await db.mutations.update(
        row.seq!,
        result && !error
          ? { status: "synced", result, error: undefined, leaseUntil: undefined }
          : {
              status: conflictReason ? "conflict" : navigator.onLine ? "failed" : "pending",
              conflictReason,
              error,
              retryable,
              nextAttemptAt: Date.now() + (Number.isFinite(retryDelay) ? retryDelay : 300_000),
              leaseUntil: undefined,
            }
      );
      if (result && !error) {
        await db.localEntries.update(row.entryId, {
          serverUpdatedAt: result.updatedAt ?? undefined,
        });
      }
      await refreshStatus(userId, row.entryId);
    });
    if (result && !error) window.dispatchEvent(new Event("vibejournal-synced"));
  }
}
