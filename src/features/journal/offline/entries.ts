"use client";
import { journalLocalDb } from "../drafts/storage";
import type { JournalCreateInput } from "../schemas";
import { enqueueMutation, replayQueue } from "../sync/queue";

export async function createLocalEntry(
  userId: string,
  values: JournalCreateInput,
  id = crypto.randomUUID()
) {
  await enqueueMutation(userId, id, "create", values);
  return (await journalLocalDb().localEntries.get(id))!;
}
export async function syncLocalEntry(userId: string, id: string) {
  return replayQueue(userId, { entryId: id, retry: true });
}
