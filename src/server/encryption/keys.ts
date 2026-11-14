import "server-only";
import { randomUUID } from "node:crypto";
import { KeyAccessError, type ContentContext, type ContentKeyProvider } from "./envelope";
import { keyWrapper } from "./wrapping";
import * as repository from "./key-repository";

export function encryptionEnvironment() {
  const value = process.env.JOURNAL_ENCRYPTION_ENV;
  if (!value || value.length > 80) throw new KeyAccessError();
  return value;
}
const cache = new Map<string, { bytes: Buffer; expires: number }>();
export function clearKeyCache() {
  for (const row of cache.values()) row.bytes.fill(0);
  cache.clear();
}
async function unwrap(
  row: NonNullable<Awaited<ReturnType<typeof repository.findKey>>>,
  context: ContentContext
) {
  if (row.environment !== context.environment || row.provider !== process.env.JOURNAL_KEY_PROVIDER)
    throw new KeyAccessError();
  // Validate configuration even on a warm cache, including the production dev-key ban.
  const wrapper = keyWrapper();
  if (row.provider === "development" && process.env.NODE_ENV === "production")
    throw new KeyAccessError();
  const cached = cache.get(row.id);
  if (cached && cached.expires > Date.now())
    return { id: row.id, bytes: Buffer.from(cached.bytes) };
  cached?.bytes.fill(0);
  cache.delete(row.id);
  const bytes = await wrapper.unwrap(row.wrapped, row.wrappingKeyId, {
    environment: row.environment,
    userId: row.userId,
    purpose: row.purpose,
    version: String(row.version),
  });
  if (bytes.length !== 32) {
    bytes.fill(0);
    throw new KeyAccessError();
  }
  if (cache.size >= 200) {
    const first = cache.keys().next().value!;
    cache.get(first)?.bytes.fill(0);
    cache.delete(first);
  }
  cache.set(row.id, { bytes: Buffer.from(bytes), expires: Date.now() + 300_000 });
  return { id: row.id, bytes };
}
export const contentKeys: ContentKeyProvider = {
  async current(context) {
    try {
      const version =
        context.purpose === "tag-index" ? 1 : Number(process.env.JOURNAL_DATA_KEY_VERSION ?? 1);
      if (!Number.isSafeInteger(version) || version < 1) throw new KeyAccessError();
      let row = await repository.findKey(context.userId, context.purpose, version);
      if (!row) {
        const generated = await keyWrapper().generate({
          environment: context.environment,
          userId: context.userId,
          purpose: context.purpose,
          version: String(version),
        });
        generated.plaintext.fill(0);
        try {
          row = await repository.insertKey({
            id: randomUUID(),
            userId: context.userId,
            purpose: context.purpose,
            version,
            environment: context.environment,
            provider: process.env.JOURNAL_KEY_PROVIDER!,
            wrapped: generated.wrapped,
            wrappingKeyId: generated.wrappingKeyId,
          });
        } catch {
          row = await repository.findKey(context.userId, context.purpose, version);
          if (!row) throw new KeyAccessError();
        }
      }
      return await unwrap(row, context);
    } catch {
      throw new KeyAccessError();
    }
  },
  async byId(id, context) {
    try {
      const row = await repository.findKeyById(id, context.userId, context.purpose);
      if (!row) throw new KeyAccessError();
      return await unwrap(row, context);
    } catch {
      throw new KeyAccessError();
    }
  },
};
