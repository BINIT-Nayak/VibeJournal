// Pure validation only: also loaded by next.config.ts outside the React runtime.
// Environment values are read exclusively by the server-only accessor/startup hooks.
import { z } from "zod";
import { publicEnvSchema } from "../../lib/env/public";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalText = z.preprocess(
  blankToUndefined,
  z
    .string()
    .min(1)
    .refine((value) => value.trim().length > 0, "Must not be blank.")
    .optional()
);
function urlWithProtocols(protocols: string[]) {
  return z.string().refine(
    (value) => {
      try {
        const url = new URL(value);
        return protocols.includes(url.protocol) && Boolean(url.hostname);
      } catch {
        return false;
      }
    },
    `Must be a valid ${protocols.join(" or ")} URL with a hostname.`
  );
}
const origin = urlWithProtocols(["http:", "https:"]).refine((value) => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
  } catch {
    return false;
  }
}, "Must be an HTTP(S) origin without credentials, a path, query, or fragment.");
const positiveInteger = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);

export const serverEnvSchema = z
  .object({
    VIBEJOURNAL_TEST_SERVER: z.enum(["0", "1"]).optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: urlWithProtocols(["postgres:", "postgresql:"]),
    AUTH_SECRET: z
      .string()
      .min(32, "Required; use a random secret of at least 32 characters.")
      .refine((value) => value === value.trim(), "Must not have surrounding whitespace."),
    AUTH_URL: origin,
    REDIS_URL: z.preprocess(blankToUndefined, urlWithProtocols(["redis:", "rediss:"]).optional()),
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    AI_JOURNAL_PROVIDER: z.preprocess(blankToUndefined, z.literal("anthropic").optional()),
    ANTHROPIC_API_KEY: optionalText,
    AI_JOURNAL_MODEL: z.preprocess(blankToUndefined, z.string().min(1).max(200).optional()),
    AI_JOURNAL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    JOURNAL_ENCRYPTION_ENV: z
      .string()
      .min(1)
      .max(80)
      .refine(
        (value) => value.trim() === value && value.trim().length > 0,
        "Required stable environment identifier without surrounding whitespace."
      ),
    JOURNAL_KEY_PROVIDER: z.enum(["development", "aws-kms"]),
    JOURNAL_DEVELOPMENT_WRAPPING_KEY: optionalText,
    AWS_REGION: optionalText,
    JOURNAL_KMS_KEY_ID: optionalText,
    JOURNAL_KMS_PREVIOUS_KEY_IDS: optionalText,
    JOURNAL_DATA_KEY_VERSION: positiveInteger(1, Number.MAX_SAFE_INTEGER),
    PROFILE_DATABASE: z.preprocess(blankToUndefined, z.enum(["0", "1"]).default("0")),
  })
  .superRefine((env, context) => {
    const issue = (field: keyof typeof env, message: string) =>
      context.addIssue({ code: "custom", path: [field], message });
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      issue(
        env.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID",
        "Required when Google login is configured; set both Google credentials or neither."
      );
    }
    if (env.AI_JOURNAL_PROVIDER) {
      if (!env.ANTHROPIC_API_KEY)
        issue("ANTHROPIC_API_KEY", "Required when AI_JOURNAL_PROVIDER=anthropic.");
      if (!env.AI_JOURNAL_MODEL)
        issue("AI_JOURNAL_MODEL", "Required when AI_JOURNAL_PROVIDER=anthropic.");
    }
    if (env.JOURNAL_KEY_PROVIDER === "development") {
      if (env.NODE_ENV === "production")
        issue(
          "JOURNAL_KEY_PROVIDER",
          "Production requires aws-kms; development keys are not allowed."
        );
      const encoded = env.JOURNAL_DEVELOPMENT_WRAPPING_KEY ?? "";
      const bytes = Buffer.from(encoded, "base64");
      const valid = bytes.length === 32 && bytes.toString("base64") === encoded;
      bytes.fill(0);
      if (!valid)
        issue(
          "JOURNAL_DEVELOPMENT_WRAPPING_KEY",
          "Required canonical base64-encoded 32-byte key; generate with openssl rand -base64 32."
        );
    } else {
      if (!env.AWS_REGION) issue("AWS_REGION", "Required when JOURNAL_KEY_PROVIDER=aws-kms.");
      if (!env.JOURNAL_KMS_KEY_ID)
        issue("JOURNAL_KMS_KEY_ID", "Required when JOURNAL_KEY_PROVIDER=aws-kms.");
    }
  });
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(input: Record<string, string | undefined>): Readonly<ServerEnv> {
  const result = serverEnvSchema.safeParse(input);
  // Direct client references could expose NEXT_PUBLIC_ secrets while bypassing
  // publicEnv. Require explicit review/allowlisting before startup.
  const publicFields = new Set(Object.keys(publicEnvSchema.shape));
  const unknownPublic = Object.keys(input).filter(
    (key) => key.startsWith("NEXT_PUBLIC_") && !publicFields.has(key)
  );
  const errors = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  for (const key of unknownPublic)
    errors.push(`${key}: Not declared in the safe public environment allowlist.`);
  if (errors.length) {
    // No raw Zod error, input values, cause, or environment object is attached.
    throw new Error(
      `Invalid VibeJournal environment configuration:\n${errors.map((error) => `- ${error}`).join("\n")}\nCheck .env.example and restart the server.`
    );
  }
  if (!result.success) throw new Error("Invalid VibeJournal environment configuration.");
  return Object.freeze(result.data);
}
