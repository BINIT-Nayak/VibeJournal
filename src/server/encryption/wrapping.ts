import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { KeyAccessError } from "./envelope";
export type KeyContext = { environment: string; userId: string; purpose: string; version: string };
export interface KeyWrapper {
  generate(
    context: KeyContext
  ): Promise<{ plaintext: Buffer; wrapped: string; wrappingKeyId: string }>;
  unwrap(wrapped: string, wrappingKeyId: string, context: KeyContext): Promise<Buffer>;
}
function developmentKey() {
  if (process.env.NODE_ENV === "production" || process.env.JOURNAL_KEY_PROVIDER !== "development")
    throw new KeyAccessError();
  const encoded = process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY ?? "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new KeyAccessError();
  return key;
}
export function keyWrapper(): KeyWrapper {
  if (process.env.JOURNAL_KEY_PROVIDER === "development") {
    return {
      async generate(context) {
        const wrapping = developmentKey(),
          nonce = randomBytes(12),
          plaintext = randomBytes(32);
        try {
          const cipher = createCipheriv("aes-256-gcm", wrapping, nonce);
          cipher.setAAD(Buffer.from(JSON.stringify(context)));
          const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
          return {
            plaintext,
            wrappingKeyId: "development-v1",
            wrapped: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64"),
          };
        } catch {
          plaintext.fill(0);
          throw new KeyAccessError();
        } finally {
          wrapping.fill(0);
        }
      },
      async unwrap(wrapped, wrappingKeyId, context) {
        const wrapping = developmentKey();
        try {
          if (wrappingKeyId !== "development-v1") throw new KeyAccessError();
          const value = Buffer.from(wrapped, "base64");
          if (value.length !== 60) throw new KeyAccessError();
          const decipher = createDecipheriv("aes-256-gcm", wrapping, value.subarray(0, 12));
          decipher.setAAD(Buffer.from(JSON.stringify(context)));
          decipher.setAuthTag(value.subarray(12, 28));
          return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]);
        } catch {
          throw new KeyAccessError();
        } finally {
          wrapping.fill(0);
        }
      },
    };
  }
  if (process.env.JOURNAL_KEY_PROVIDER !== "aws-kms") throw new KeyAccessError();
  const keyId = process.env.JOURNAL_KMS_KEY_ID;
  const region = process.env.AWS_REGION;
  if (!keyId || !region) throw new KeyAccessError();
  const allowed = new Set([
    keyId,
    ...(process.env.JOURNAL_KMS_PREVIOUS_KEY_IDS ?? "").split(",").filter(Boolean),
  ]);
  const client = new KMSClient({ region, maxAttempts: 2 });
  return {
    async generate(context) {
      try {
        const result = await client.send(
          new GenerateDataKeyCommand({
            KeyId: keyId,
            KeySpec: "AES_256",
            EncryptionContext: context,
          }),
          { abortSignal: AbortSignal.timeout(5000) }
        );
        if (!result.Plaintext || !result.CiphertextBlob || result.Plaintext.length !== 32)
          throw new KeyAccessError();
        const plaintext = Buffer.from(result.Plaintext);
        result.Plaintext.fill(0);
        return {
          plaintext,
          wrappingKeyId: keyId,
          wrapped: Buffer.from(result.CiphertextBlob).toString("base64"),
        };
      } catch {
        throw new KeyAccessError();
      }
    },
    async unwrap(wrapped, wrappingKeyId, context) {
      try {
        if (!allowed.has(wrappingKeyId)) throw new KeyAccessError();
        const result = await client.send(
          new DecryptCommand({
            KeyId: wrappingKeyId,
            CiphertextBlob: Buffer.from(wrapped, "base64"),
            EncryptionContext: context,
          }),
          { abortSignal: AbortSignal.timeout(5000) }
        );
        if (!result.Plaintext || result.Plaintext.length !== 32) throw new KeyAccessError();
        const plaintext = Buffer.from(result.Plaintext);
        result.Plaintext.fill(0);
        return plaintext;
      } catch {
        throw new KeyAccessError();
      }
    },
  };
}
