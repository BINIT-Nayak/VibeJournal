import { z } from "zod";
import { journalCreateSchema } from "../schemas";
const base = { key: z.uuid(), entryId: z.string().min(1).max(128) };
export const journalMutationSchema = z.discriminatedUnion("kind", [
  z
    .object({ ...base, entryId: z.uuid(), kind: z.literal("create"), values: journalCreateSchema })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("update"),
      values: journalCreateSchema,
      expectedUpdatedAt: z.iso.datetime(),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("delete"), expectedUpdatedAt: z.iso.datetime() }).strict(),
]);
export type JournalMutation = z.infer<typeof journalMutationSchema>;
export const mutationResultSchema = z
  .object({ entryId: z.string(), updatedAt: z.iso.datetime().nullable(), deleted: z.boolean() })
  .strict();
export type MutationResult = z.infer<typeof mutationResultSchema>;
