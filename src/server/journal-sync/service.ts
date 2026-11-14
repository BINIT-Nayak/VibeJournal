import "server-only";
import { sealJournal, openJournal, protectTag, sealValue, openValue } from "../encryption/content";
import { createHash, timingSafeEqual } from "node:crypto";
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

export class JournalVersionConflictError extends JournalConflictError {}

export async function replayMutation(userId: string, input: unknown) {
  if (!userId) throw new Error("UNAUTHORIZED");
  const mutation = journalMutationSchema.parse(input);
  // Zod constructs keys in a stable order and normalizes the same form fields.
  const payloadHash = createHash("sha256").update(JSON.stringify(mutation)).digest("hex");
  const matches = async (encoded: string) => {
    const fingerprint = await openValue(userId, "receipt", mutation.key, encoded);
    if (
      typeof fingerprint !== "string" ||
      fingerprint.length !== 64 ||
      !/^[0-9a-f]+$/.test(fingerprint)
    )
      return false;
    return timingSafeEqual(Buffer.from(fingerprint, "hex"), Buffer.from(payloadHash, "hex"));
  };
  const prior = await receipts.lookupReceipt(userId, mutation.key);
  if (prior) {
    if (!(await matches(prior.payloadHash))) throw new JournalConflictError();
    return mutationResultSchema.parse(prior.result);
  }
  // Prepare encryption/key access before entering the mutation transaction.
  const snapshot =
    mutation.kind === "update" ? await journal.findByOwner(userId, mutation.entryId) : null;
  const plaintext = snapshot ? await openJournal(userId, snapshot) : undefined;
  const sealed =
    mutation.kind === "delete"
      ? undefined
      : await sealJournal(
          userId,
          mutation.entryId,
          mutation.kind === "create" ? 1 : (snapshot?.contentRevision ?? 0) + 1,
          { ...plaintext, ...mutation.values }
        );
  const tags =
    mutation.kind === "delete"
      ? []
      : await Promise.all((mutation.values.tags ?? []).map((label) => protectTag(userId, label)));
  const protectedHash = await sealValue(userId, "receipt", mutation.key, payloadHash);
  const committed = await receipts.transaction(
    userId,
    mutation.key,
    mutation.entryId,
    async (tx) => {
      const receipt = await receipts.receipt(tx, userId, mutation.key);
      if (receipt) {
        if (!(await matches(receipt.payloadHash))) throw new JournalConflictError();
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
          const { tags: ignoredTags, ...fields } = mutation.values;
          void ignoredTags;
          const row = await journal.create(
            userId,
            { ...fields, id: mutation.entryId, ...sealed! },
            tags,
            tx
          );
          result = { entryId: row.id, updatedAt: row.updatedAt.toISOString(), deleted: false };
          created = true;
        }
      } else {
        if (!existing) throw new JournalNotFoundError();
        const expected = new Date(mutation.expectedUpdatedAt);
        if (+existing.updatedAt !== +expected) throw new JournalVersionConflictError();
        if (mutation.kind === "update") {
          if (!snapshot || snapshot.contentRevision !== existing.contentRevision)
            throw new JournalVersionConflictError();
          const { tags: ignoredTags, ...fields } = mutation.values;
          void ignoredTags;
          const row = await journal.updateByOwner(
            userId,
            mutation.entryId,
            expected,
            {
              ...fields,
              ...sealed!,
              updatedAt: new Date(Math.max(Date.now(), +expected + 1)),
            },
            tags,
            tx
          );
          if (!row) throw new JournalVersionConflictError();
          result = { entryId: row.id, updatedAt: row.updatedAt.toISOString(), deleted: false };
        } else {
          const deleted = await journal.deleteVersion(userId, mutation.entryId, expected, tx);
          if (!deleted.count) throw new JournalVersionConflictError();
          result = { entryId: mutation.entryId, updatedAt: null, deleted: true };
        }
      }
      await receipts.saveReceipt(tx, {
        userId,
        key: mutation.key,
        entryId: mutation.entryId,
        kind: mutation.kind,
        payloadHash: protectedHash,
        result,
      });
      return { result, created };
    }
  );
  await invalidateAnalytics(userId);
  if (committed.created) await analyzeCreatedEntry(userId, mutation.entryId);
  return committed.result;
}
