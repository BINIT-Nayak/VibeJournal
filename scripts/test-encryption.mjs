import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { load } from "./encryption-loader.mjs";
const { encryptText, decryptText, EncryptionError } = load("src/server/encryption/envelope.ts");
const key = randomBytes(32),
  id = randomUUID();
const provider = {
  current: async () => ({ id, bytes: Buffer.from(key) }),
  byId: async () => ({ id, bytes: Buffer.from(key) }),
};
const context = {
  environment: "test",
  userId: "owner",
  purpose: "journal",
  recordId: "entry",
  revision: "1",
};
const plaintext = "Private journal 🌱\nA thoughtful day.";
const encoded = await encryptText(plaintext, context, provider);
assert.equal(await decryptText(encoded, context, provider), plaintext);
assert.notEqual(await encryptText(plaintext, context, provider), encoded);
assert.ok(!encoded.includes(plaintext));
assert.equal(await decryptText(await encryptText("", context, provider), context, provider), "");
for (const field of Object.keys(context)) {
  await assert.rejects(
    decryptText(encoded, { ...context, [field]: "different" }, provider),
    EncryptionError
  );
}
const parsed = JSON.parse(Buffer.from(encoded.slice(3), "base64").toString());
for (const field of ["ciphertext", "nonce", "tag"]) {
  const bytes = Buffer.from(parsed[field], "base64");
  bytes[0] ^= 1;
  const tampered =
    "e1." +
    Buffer.from(JSON.stringify({ ...parsed, [field]: bytes.toString("base64") })).toString(
      "base64"
    );
  await assert.rejects(decryptText(tampered, context, provider), EncryptionError);
}
for (const changes of [{ v: 2 }, { alg: "none" }, { keyId: randomUUID() }, { extra: plaintext }]) {
  await assert.rejects(
    decryptText(
      "e1." + Buffer.from(JSON.stringify({ ...parsed, ...changes })).toString("base64"),
      context,
      provider
    ),
    EncryptionError
  );
}
for (const malformed of ["", plaintext, "e1.not-base64!", "e2." + encoded.slice(3)])
  await assert.rejects(decryptText(malformed, context, provider), EncryptionError);
await assert.rejects(
  decryptText(encoded, context, {
    ...provider,
    byId: async () => ({ id, bytes: randomBytes(32) }),
  }),
  EncryptionError
);
const denied = {
  current: async () => {
    throw new Error("sensitive provider details");
  },
  byId: async () => {
    throw new Error("sensitive provider details");
  },
};
for (const operation of [
  encryptText(plaintext, context, denied),
  decryptText(encoded, context, denied),
]) {
  await assert.rejects(
    operation,
    (error) =>
      error instanceof EncryptionError && !error.message.includes("sensitive") && !error.cause
  );
}
const { keyWrapper } = load("src/server/encryption/wrapping.ts");
process.env.JOURNAL_KEY_PROVIDER = "development";
process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY = randomBytes(32).toString("base64");
const wrappingContext = { environment: "test", userId: "owner", purpose: "journal", version: "1" };
const wrapper = keyWrapper();
const wrapped = await wrapper.generate(wrappingContext);
assert.deepEqual(
  await wrapper.unwrap(wrapped.wrapped, wrapped.wrappingKeyId, wrappingContext),
  wrapped.plaintext
);
await assert.rejects(
  wrapper.unwrap(wrapped.wrapped, wrapped.wrappingKeyId, { ...wrappingContext, userId: "other" }),
  EncryptionError
);
process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY = randomBytes(32).toString("base64");
await assert.rejects(
  wrapper.unwrap(wrapped.wrapped, wrapped.wrappingKeyId, wrappingContext),
  EncryptionError
);
delete process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY;
await assert.rejects(wrapper.generate(wrappingContext), EncryptionError);
process.env.NODE_ENV = "production";
await assert.rejects(wrapper.generate(wrappingContext), EncryptionError);
console.log(
  "Encryption tests passed: round trips, random nonces, tampering, context binding, malformed data, wrong/missing keys, sanitized failures, production development-key rejection."
);

// Exercise the real AWS adapter with the SDK transport replaced; no AWS account is contacted.
const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = await import("@aws-sdk/client-kms");
const originalSend = KMSClient.prototype.send;
process.env.JOURNAL_KEY_PROVIDER = "aws-kms";
process.env.JOURNAL_KMS_KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/test";
process.env.AWS_REGION = "us-east-1";
let calls = 0;
KMSClient.prototype.send = async function (command, options) {
  calls++;
  assert.equal(command.input.KeyId, process.env.JOURNAL_KMS_KEY_ID);
  assert.deepEqual(command.input.EncryptionContext, wrappingContext);
  assert.ok(options.abortSignal);
  assert.ok(command instanceof GenerateDataKeyCommand || command instanceof DecryptCommand);
  return { Plaintext: Buffer.from(key), CiphertextBlob: Buffer.from("wrapped-key") };
};
try {
  const kms = keyWrapper();
  const result = await kms.generate(wrappingContext);
  assert.deepEqual(result.plaintext, key);
  assert.deepEqual(await kms.unwrap(result.wrapped, result.wrappingKeyId, wrappingContext), key);
  assert.equal(calls, 2);
  await assert.rejects(
    kms.unwrap(result.wrapped, "unapproved-key", wrappingContext),
    EncryptionError
  );
  assert.equal(calls, 2);
  KMSClient.prototype.send = async () => {
    throw new Error("secret AWS diagnostics");
  };
  await assert.rejects(
    kms.generate(wrappingContext),
    (error) => error instanceof EncryptionError && !error.message.includes("secret")
  );
  await assert.rejects(
    kms.unwrap(result.wrapped, result.wrappingKeyId, wrappingContext),
    EncryptionError
  );
  console.log(
    "AWS KMS adapter tests passed: encryption context, key allowlist, transport failure sanitization."
  );
} finally {
  KMSClient.prototype.send = originalSend;
}
