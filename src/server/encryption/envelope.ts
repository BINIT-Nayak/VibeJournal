import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

export class EncryptionError extends Error {
  constructor() {
    super("Protected journal data is temporarily unavailable.");
    this.name = "EncryptionError";
  }
}
export class KeyAccessError extends EncryptionError {
  constructor() {
    super();
    this.name = "KeyAccessError";
  }
}
export type ContentContext = {
  environment: string;
  userId: string;
  purpose: string;
  recordId: string;
  revision: string;
};
export type DataKey = { id: string; bytes: Buffer };
export interface ContentKeyProvider {
  current(context: ContentContext): Promise<DataKey>;
  byId(id: string, context: ContentContext): Promise<DataKey>;
}
const envelopeSchema = z
  .object({
    v: z.literal(1),
    alg: z.literal("A256GCM"),
    keyId: z.uuid(),
    nonce: z.string().max(32),
    tag: z.string().max(32),
    ciphertext: z.string().max(1_400_000),
  })
  .strict();
function binary(value: string, length?: number) {
  const result = Buffer.from(value, "base64");
  if (result.toString("base64") !== value || (length !== undefined && result.length !== length))
    throw new EncryptionError();
  return result;
}
function aad(context: ContentContext, keyId: string) {
  if (Object.values(context).some((value) => !value)) throw new EncryptionError();
  return Buffer.from(
    JSON.stringify([
      "vibejournal",
      1,
      "A256GCM",
      context.environment,
      context.userId,
      context.purpose,
      context.recordId,
      context.revision,
      keyId,
    ])
  );
}
export async function encryptText(
  plaintext: string,
  context: ContentContext,
  provider: ContentKeyProvider
) {
  let key: DataKey | undefined;
  try {
    if (Buffer.byteLength(plaintext, "utf8") > 1_000_000) throw new EncryptionError();
    key = await provider.current(context);
    if (key.bytes.length !== 32 || !z.uuid().safeParse(key.id).success) throw new KeyAccessError();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key.bytes, nonce, { authTagLength: 16 });
    cipher.setAAD(aad(context, key.id));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return (
      "e1." +
      Buffer.from(
        JSON.stringify({
          v: 1,
          alg: "A256GCM",
          keyId: key.id,
          nonce: nonce.toString("base64"),
          tag: cipher.getAuthTag().toString("base64"),
          ciphertext: ciphertext.toString("base64"),
        })
      ).toString("base64")
    );
  } catch (error) {
    throw error instanceof KeyAccessError ? error : new EncryptionError();
  } finally {
    key?.bytes.fill(0);
  }
}
export async function decryptText(
  encoded: string,
  context: ContentContext,
  provider: ContentKeyProvider
) {
  let key: DataKey | undefined;
  try {
    if (!encoded.startsWith("e1.") || encoded.length > 1_900_000) throw new EncryptionError();
    const envelope = envelopeSchema.parse(JSON.parse(binary(encoded.slice(3)).toString("utf8")));
    const nonce = binary(envelope.nonce, 12),
      tag = binary(envelope.tag, 16);
    const ciphertext = binary(envelope.ciphertext);
    key = await provider.byId(envelope.keyId, context);
    if (key.bytes.length !== 32 || key.id !== envelope.keyId) throw new KeyAccessError();
    const decipher = createDecipheriv("aes-256-gcm", key.bytes, nonce, { authTagLength: 16 });
    decipher.setAAD(aad(context, key.id));
    decipher.setAuthTag(tag);
    // No unauthenticated plaintext leaves this function before final() succeeds.
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    throw error instanceof KeyAccessError ? error : new EncryptionError();
  } finally {
    key?.bytes.fill(0);
  }
}
