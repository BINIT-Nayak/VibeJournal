import "server-only";
import { createHash } from "node:crypto";
import {
  journalMutationSchema,
  mutationResultSchema,
  type MutationResult,
} from "@/features/journal/sync/schemas";
import * as receipts from "./repository";
import * as journal from "../journal/repository";
import { JournalConflictError, JournalNotFoundError } from "../journal/service";
import { invalidateAnalytics } from "../analytics/cache";
import { analyzeCreatedEntry } from "../journal-analysis/after-create";

export async function replayMutation(userId: string, input: unknown) {
  if (!userId) throw new Error("UNAUTHORIZED");
  const mutation = journalMutationSchema.parse(input);
  // Zod constructs keys in a stable order and normalizes the same form fields.
  const payloadHash = createHash("sha256").update(JSON.stringify(mutation)).digest("hex");
  const committed = await receipts.transaction(
    userId,
    mutation.key,
    mutation.entryId,
    async (tx) => {
      const receipt = await receipts.receipt(tx, userId, mutation.key);
      if (receipt) {
        if (receipt.payloadHash !== payloadHash) throw new JournalConflictError();
        return { result: mutationResultSchema.parse(receipt.result), created: false };
      }
      const existing = await journal.findByOwner(userId, mutation.entryId, tx);
      let result: MutationResult;
      let created = false;
      if (mutation.kind === "create") {
        if (existing) {
          result = {
            entryId: existing.id,
            updatedAt: existing.updatedAt.toISOString(),
            deleted: false,
          };
        } else {
          if (await receipts.previousMutation(tx, userId, mutation.entryId))
            throw new JournalConflictError();
          const { tags = [], ...fields } = mutation.values;
          const row = await journal.create(
            userId,
            { ...fields, id: mutation.entryId, legacyTags: tags },
            tags,
            tx
          );
          result = { entryId: row.id, updatedAt: row.updatedAt.toISOString(), deleted: false };
          created = true;
        }
      } else {
        if (!existing) throw new JournalNotFoundError();
        const expected = new Date(mutation.expectedUpdatedAt);
        if (+existing.updatedAt !== +expected) throw new JournalConflictError();
        if (mutation.kind === "update") {
          const { tags = [], ...fields } = mutation.values;
          const row = await journal.updateByOwner(
            userId,
            mutation.entryId,
            expected,
            {
              ...fields,
              legacyTags: tags,
              updatedAt: new Date(Math.max(Date.now(), +expected + 1)),
            },
            tags,
            tx
          );
          if (!row) throw new JournalConflictError();
          result = { entryId: row.id, updatedAt: row.updatedAt.toISOString(), deleted: false };
        } else {
          const deleted = await journal.deleteVersion(userId, mutation.entryId, expected, tx);
          if (!deleted.count) throw new JournalConflictError();
          result = { entryId: mutation.entryId, updatedAt: null, deleted: true };
        }
      }
      await receipts.saveReceipt(tx, {
        userId,
        key: mutation.key,
        entryId: mutation.entryId,
        kind: mutation.kind,
        payloadHash,
        result,
      });
      return { result, created };
    }
  );
  await invalidateAnalytics(userId);
  if (committed.created) await analyzeCreatedEntry(userId, mutation.entryId);
  return committed.result;
}
