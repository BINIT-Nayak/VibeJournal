import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { decryptText, encryptText, EncryptionError, type ContentContext } from "./envelope";
import { contentKeys, encryptionEnvironment } from "./keys";
import type { JournalEntryWithTags } from "../journal/repository";

export function context(
  userId: string,
  purpose: string,
  recordId: string,
  revision = "1"
): ContentContext {
  return { environment: encryptionEnvironment(), userId, purpose, recordId, revision };
}
export const privateJournalSchema = z
  .object({
    title: z.string().max(200).nullable(),
    content: z.string().max(20000),
    voiceNote: z.string().max(20000).nullable(),
    photoNames: z.array(z.string().max(255)).max(20),
    prompt: z.string().max(20000).nullable(),
  })
  .strict();
type PrivateInput = Partial<z.infer<typeof privateJournalSchema>>;
export async function sealJournal(
  userId: string,
  id: string,
  revision: number,
  values: PrivateInput
) {
  const parsed = privateJournalSchema.safeParse({
    title: values.title ?? null,
    content: values.content ?? "",
    voiceNote: values.voiceNote ?? null,
    photoNames: values.photoNames ?? [],
    prompt: values.prompt ?? null,
  });
  if (!parsed.success || !Number.isSafeInteger(revision) || revision < 1)
    throw new EncryptionError();
  const privatePayload = await encryptText(
    JSON.stringify(parsed.data),
    context(userId, "journal", id, String(revision)),
    contentKeys
  );
  return {
    privatePayload,
    contentRevision: revision,
    title: null,
    content: "",
    voiceNote: null,
    photoNames: [] as string[],
    prompt: null,
    legacyTags: [] as string[],
  };
}
export async function openJournal<
  T extends { id: string; userId: string; privatePayload: string | null; contentRevision: number },
>(userId: string, row: T) {
  if (row.userId !== userId || !row.privatePayload || row.contentRevision < 1)
    throw new EncryptionError();
  const text = await decryptText(
    row.privatePayload,
    context(userId, "journal", row.id, String(row.contentRevision)),
    contentKeys
  );
  try {
    return { ...row, ...privateJournalSchema.parse(JSON.parse(text)) };
  } catch {
    throw new EncryptionError();
  }
}
export type ProtectedTag = { id: string; name: string; privateLabel: string };
export async function protectTag(
  userId: string,
  label: string,
  id = randomUUID()
): Promise<ProtectedTag> {
  const key = await contentKeys.current(context(userId, "tag-index", "index"));
  let name: string;
  try {
    name = "h1:" + createHmac("sha256", key.bytes).update(label).digest("hex");
  } finally {
    key.bytes.fill(0);
  }
  return {
    id,
    name,
    privateLabel: await encryptText(label, context(userId, "tag-label", id), contentKeys),
  };
}
export async function openTag(userId: string, id: string, privateLabel: string | null) {
  if (!privateLabel) throw new EncryptionError();
  return decryptText(privateLabel, context(userId, "tag-label", id), contentKeys);
}
export async function openEntry(userId: string, row: JournalEntryWithTags) {
  const entry = await openJournal(userId, row);
  const tags = await Promise.all(
    row.tags.map(async (link) => {
      if (link.userId !== userId || link.tag.userId !== userId) throw new EncryptionError();
      return {
        ...link,
        tag: { ...link.tag, name: await openTag(userId, link.tagId, link.tag.privateLabel) },
      };
    })
  );
  return { ...entry, tags };
}
export async function sealValue(
  userId: string,
  purpose: string,
  id: string,
  value: unknown,
  revision = "1"
) {
  return encryptText(JSON.stringify(value), context(userId, purpose, id, revision), contentKeys);
}
export async function openValue(
  userId: string,
  purpose: string,
  id: string,
  encoded: string | null,
  revision = "1"
): Promise<unknown> {
  if (!encoded) throw new EncryptionError();
  try {
    return JSON.parse(
      await decryptText(encoded, context(userId, purpose, id, revision), contentKeys)
    );
  } catch (error) {
    throw error instanceof EncryptionError ? error : new EncryptionError();
  }
}
