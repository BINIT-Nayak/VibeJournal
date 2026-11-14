"use client";

import Dexie, { type Table } from "dexie";
import { z } from "zod";
import { journalCreateSchema, type JournalCreateInput } from "../schemas";

// Drafts may be incomplete or invalid; submission still uses the shared strict schema.
const numeric = z.union([z.number(), z.nan()]);
const draftValues = journalCreateSchema.extend({
  title: z.string().nullable().optional(),
  content: z.string(),
  moodScore: numeric,
  energyScore: numeric.nullable().optional(),
  sleepHours: numeric.nullable().optional(),
  socialScore: numeric.nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type JournalDraft = {
  key: string;
  userId: string;
  values: JournalCreateInput;
  baseUpdatedAt?: string;
  savedAt: number;
};
export type LocalJournalEntry = {
  id: string;
  userId: string;
  values: JournalCreateInput;
  createdAt: string;
  status: "pending" | "syncing" | "synced" | "failed";
  attempt?: string;
  leaseUntil?: number;
  error?: string;
};
type DraftDatabase = Dexie & {
  drafts: Table<JournalDraft, string>;
  localEntries: Table<LocalJournalEntry, string>;
};
let database: DraftDatabase | undefined;
export function journalLocalDb() {
  if (!database) {
    database = new Dexie("vibejournal-local-drafts") as DraftDatabase;
    database.version(1).stores({ drafts: "key, userId" });
    database
      .version(2)
      .stores({ drafts: "key, userId", localEntries: "id, userId, [userId+status]" });
  }
  return database;
}
export function draftKey(userId: string, entryId?: string) {
  return JSON.stringify([userId, entryId ?? "new"]);
}
export async function readDraft(key: string, userId: string) {
  const row = await journalLocalDb().drafts.get(key);
  if (!row || row.userId !== userId) return null;
  const parsed = draftValues.safeParse(row.values);
  if (
    !parsed.success ||
    (row.baseUpdatedAt !== undefined && !z.iso.datetime().safeParse(row.baseUpdatedAt).success)
  )
    return null;
  return { ...row, values: parsed.data };
}
export function writeDraft(draft: JournalDraft) {
  return journalLocalDb().drafts.put(draft);
}
export function removeDraft(key: string) {
  return journalLocalDb().drafts.delete(key);
}
