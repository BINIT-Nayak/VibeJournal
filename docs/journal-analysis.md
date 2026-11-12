# AI journal-analysis domain

The shared contract lives in `src/features/journal-analysis/schemas.ts`.
The server-only provider boundary is
`src/server/journal-analysis/validation.ts`.

All seven fields are required; unknown keys are rejected:

| Field            | Contract                                          |
| ---------------- | ------------------------------------------------- |
| primaryEmotion   | One label from the exported emotion enum          |
| emotions         | 1–5 unique enum labels, including primaryEmotion  |
| sentimentScore   | Finite number from -1 (negative) to 1 (positive)  |
| themes           | 0–8 unique, trimmed strings, each 1–80 characters |
| estimatedEnergy  | Integer from 1 to 10                              |
| reflectionPrompt | Nonblank, trimmed text, at most 500 characters    |
| confidence       | Finite number from 0 to 1                         |

Themes are compared case-insensitively for uniqueness. Empty themes are allowed
when no theme is supported. Numeric strings are rejected rather than coerced;
no missing field is filled with a fabricated default. Confidence is model-reported,
not a calibrated probability. Estimated energy must remain separate from the
user's self-reported energy, and emotion labels are not diagnoses.

## Validation boundary

Future provider adapters must pass their output as `unknown` to
`validateJournalAnalysis` before storing, returning, or using it. It accepts a
parsed JSON object or a JSON string up to 16,000 characters, then always runs the
strict Zod schema. It does not salvage partial JSON, strip Markdown fences, or
silently accept a partial response. Failed output throws
`InvalidJournalAnalysisError` with the stable code `INVALID_JOURNAL_ANALYSIS`;
the error contains neither raw output nor detailed validation values.

`JournalAnalysis` is inferred from the schema and branded to discourage assigning
unvalidated objects. A TypeScript assertion is not validation: never cast provider
output to this type. Revalidate deserialized stored results as well. Providers'
structured-output modes do not replace this runtime check.

The provider adapter and post-creation pipeline described below are opt-in.
Existing analytics insights remain deterministic summaries. Structural validation
does not establish the truth or appropriateness of generated prose; subsequent
provider integration needs its own consent, ownership and content-handling rules.

Run `npm run test:journal-analysis` for valid payloads, missing and extra keys,
score boundaries, invalid numbers, consistency, duplicates, text limits,
malformed JSON, and generic failures. The tests compile the actual TypeScript
modules in memory, without network or database access.

## Provider abstraction

Server callers use `analyzeJournal(input, options)` from
`src/server/journal-analysis/service.ts`. The vendor-neutral
`JournalAnalysisProvider.analyze` contract accepts only title/content plus an
optional abort signal, and returns a validated `JournalAnalysis`. A provider can
be injected into the service for tests or future adapters; the service validates
its return again. No vendor response types escape into application code.

The first adapter uses the
[Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create).
Configure server environment variables:

- `AI_JOURNAL_PROVIDER=anthropic`
- `ANTHROPIC_API_KEY`: a secret API key
- `AI_JOURNAL_MODEL`: an available Messages-compatible model ID
- `AI_JOURNAL_TIMEOUT_MS=30000`: optional timeout, 1,000–120,000 ms

Configuration is lazy, so missing credentials do not break builds or non-AI
features. Missing/unsupported configuration fails closed. None of these variables
has a NEXT_PUBLIC prefix. Provider, configuration, interface, and prompts all
import `server-only`, preventing client imports through Next.js.

The adapter sends trusted instructions separately from JSON-encoded journal data.
It requests JSON and then validates it; prompt compliance is never trusted.
Only a complete end_turn response containing one text block is accepted.
Malformed JSON, refusals, truncation and invalid domain output fail closed.
Timeouts and cancellation abort the request; HTTP and network errors use generic
messages. Requests disable caching and redirects. There are no automatic retries
or fallback vendor calls, and raw responses, journal text and credentials are
never logged by this implementation.

The post-creation orchestration below checks consent and ownership before calling
this service. The provider adapter itself does not persist data or substitute
inferred values for self-reported metrics.

Run `npm run test:ai-provider` for mocked transport, runtime validation,
configuration, errors, cancellation and timeout tests. No live credentials or
journal transmission are needed. Provider availability and model-specific
behavior still require a live integration check after configuration.

## Analysis after creation

Both journal creation endpoints share `createEntry`. After the journal and tags
commit successfully, it awaits `analyzeCreatedEntry` as a simple synchronous first
version. The caller's user ID comes from server authentication. The pipeline
reloads the owned, non-archived entry and checks the existing `aiConsent` setting
before sending only its title and content to the provider.

Successful output is validated by the provider, service, and persistence boundary.
The `JournalAnalysis` model stores the seven structured fields, the source entry's
`updatedAt`, creation timestamp, and owner-scoped entry relation. There is at most
one result per entry; repeated processing upserts it. The compound foreign key
prevents cross-owner links, the owner/date index supports later lookups, and
deleting an entry (or its user) cascades to its analysis. No raw response is stored.

The write transaction locks and matches the source version, then rechecks consent.
A changed, archived, or deleted entry or withdrawn consent skips persistence.
A future read path must compare `sourceUpdatedAt` with the entry's current version
before displaying analysis; editing does not regenerate analysis in this version.

Missing configuration, provider errors, invalid output, and analysis storage
failures are contained after the entry commit. The entry still returns normally
with HTTP 201. Processing returns an internal saved/skipped/failed outcome and
does not log private output or exceptions. No retry queue is introduced.
Opted-in creation can wait up to the configured provider timeout (30 seconds by
default), plus database work. Opted-out creation never calls the provider.

Migration: `20261112090000_journal_analysis`. Run `prisma migrate deploy` and
`prisma generate` in other environments. No historical backfill runs automatically.
`npm run test:analysis-persistence` uses disposable database records and mocked
AI to verify valid persistence, invalid output, failure isolation, ownership,
consent changes, stale/deleted entries, idempotency, and cascading deletion.
