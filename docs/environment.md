# Typed environment configuration

VibeJournal validates configuration with Zod before serving requests. `next.config.ts` validates `next dev` and `next start` early enough to abort startup; `src/instrumentation.ts` also validates each Node server instance. Next.js 15 may log instrumentation failures without terminating the CLI, so both entry points are intentional.

Server code can import `getServerEnv()` from `@/server/env`. It returns a frozen, typed configuration object after successful validation, cached for that process/module instance. Restart after changes. The accessor is guarded by `server-only`, which prevents imports from Client Components. The pure schema has no environment reads and can also run in the Next configuration loader and tests. Existing library integrations (Prisma, Auth.js, AWS credentials) still read their own environment settings; startup validation runs before requests use them.

Client code can import `publicEnv` from `@/lib/env/public`. Its allowlist is currently empty because no application variable needs browser exposure. Server credentials must never be passed to client components or copied into `next.config.ts`'s `env` option. Startup rejects undeclared `NEXT_PUBLIC_*` names. To introduce a genuinely public setting, add its schema and an explicit `process.env.NEXT_PUBLIC_NAME` read in the public module; validate the value there. Never spread `process.env` into a browser object. Public values are build-time values, not runtime deployment secrets.

## Required configuration

| Setting                  | Validation                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL URL using `postgres:` or `postgresql:` with a hostname                                       |
| `AUTH_SECRET`            | At least 32 characters, no surrounding whitespace; generate randomly                                    |
| `AUTH_URL`               | HTTP(S) browser-facing origin without credentials, path, query, or fragment                             |
| `JOURNAL_ENCRYPTION_ENV` | Stable nonblank identifier, at most 80 characters                                                       |
| `JOURNAL_KEY_PROVIDER`   | `development` or `aws-kms`                                                                              |
| Development provider     | Requires a canonical base64 32-byte `JOURNAL_DEVELOPMENT_WRAPPING_KEY`; forbidden in production         |
| AWS KMS provider         | Requires `AWS_REGION` and `JOURNAL_KMS_KEY_ID`; credentials come from the SDK's normal credential chain |

`AUTH_URL=http://localhost:3000` is appropriate for the default local server. A production deployment uses its public origin. Generate secrets with the commands in `.env.example`; preserve existing encryption keys.

## Optional integrations

- Redis may be absent/blank; when supplied, its URL must use `redis:` or `rediss:`. Network outages still use the application's existing fallbacks.
- Google login requires both client ID and secret, or neither.
- AI stays disabled when `AI_JOURNAL_PROVIDER` is blank. Selecting `anthropic` requires an API key and model. The timeout is an integer from 1,000 to 120,000 ms, defaulting to 30,000.
- `JOURNAL_DATA_KEY_VERSION` defaults to 1 and must be a positive safe integer.
- `VIBEJOURNAL_TEST_SERVER=1` selects an isolated development build directory for the test runner; it does not bypass validation or authentication.
- `PROFILE_DATABASE` accepts `0` or `1`, defaulting to `0`.
- Optional text fields may be empty and are treated as absent. Numeric defaults apply when omitted; explicitly empty or malformed numbers are rejected. Unknown non-public platform variables are ignored; only declared application settings enter the typed object.

Validation checks configuration shape and required dependencies, not service reachability, database migrations, API-key validity, or AWS permissions. It does not contact external services.

## Errors and deployment timing

Errors identify variable names and safe validation guidance, not their supplied values. Raw Zod errors, input objects, URLs containing passwords, and keys are not attached to the thrown error.

```text
Invalid VibeJournal environment configuration:
- AUTH_SECRET: Required; use a random secret of at least 32 characters.
Check .env.example and restart the server.
```

Production builds deliberately do not require server deployment secrets. Supply them when starting the server or container; the startup checks then run. The development provider in `.env.example` is valid for `npm run dev`, but deliberately fails `npm run start`. Configure AWS KMS for production; there is no skip-validation switch.

Next.js loads `.env*` before configuration validation. `.env.local` overrides `.env`, and explicit shell/container environment overrides files. Prisma CLI is separate and still reads its own configuration; see [local infrastructure](local-infrastructure.md).

## Tests

```sh
npm run test:env
npm run build
npm run test:env-startup
```

The schema suite covers required/malformed configuration, optional providers, numeric types, public allowlisting, and secret redaction. The startup suite launches isolated production servers on port 3188 (override with `ENV_TEST_PORT`) and checks invalid-config exits and a valid anonymous endpoint. It uses synthetic credentials and never calls KMS or AI providers.

References: [Next.js instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) and [environment-variable handling](https://nextjs.org/docs/app/guides/environment-variables).
