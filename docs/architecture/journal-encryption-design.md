# Journal content encryption design

Status: **proposed, documentation only**. Reviewed 14 November 2026. No encryption,
schema migration, key provisioning, or change to existing data has been implemented.

## Recommendation and scope

Use **server-side application envelope encryption** for free-form journal content,
with random per-user data-encryption keys (DEKs) wrapped by a managed key-management
service (KMS). Keep explicitly selected numeric/categorical fields queryable for
analytics. Encrypt labels and prose that can reveal the same information as the
journal itself. Keep cryptography in server services, outside React and Prisma
repositories.

This protects sensitive text in a stolen database, SQL dump, or database-only
backup when the attacker lacks KMS access. It is **not end-to-end encryption**:
the authenticated application can decrypt content for display, export, conflict
review, and consented AI analysis. If the goal is to prevent the application
operator from reading journals, this design must be replaced with a client-held
key design and substantial changes to recovery, AI, and server features.

Server encryption and browser encryption are separate deliverables. The initial
server release must not claim to encrypt browser drafts, queue payloads, downloads,
or all wellness information. A proposed local-vault phase is described below.

## Current architecture: verified code, not deployment assumptions

| Surface                                                                                                         | Current behavior                                                                                                                                  | Design consequence                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Prisma schema](../../prisma/schema.prisma)                                                                     | JournalEntry stores title/content, voiceNote, photoNames, prompt and legacyTags in plaintext. Numeric context is separate. Tag.name is plaintext. | Encrypt all free-form content, including duplicate/legacy representations.                                     |
| [Journal repository](../../src/server/journal/repository.ts) and [service](../../src/server/journal/service.ts) | Repository handles queries/transactions; service validates and enforces ownership. Both canonical and legacy routes use these paths.              | Retain this separation; introduce explicit encrypted persistence types and a service mapping boundary.         |
| [Serializer](../../src/server/api.ts), dashboard, current-user payload                                          | Full rows become DTOs, including the legacy note alias. Dashboard reads five recent entries; current-user/export paths can read history.          | All serializers need decrypted domain objects, not raw Prisma rows. Preview fields also require decryption.    |
| [Analytics repository](../../src/server/analytics/repository.ts)                                                | SQL computes mood, energy, sleep, exercise and tag aggregates without reading journal text.                                                       | Numeric calculations can remain unchanged; tag SQL must aggregate IDs rather than names.                       |
| [AI analysis](../../src/server/journal-analysis/after-create.ts)                                                | Title/content go to a provider after consent checks; themes and reflectionPrompt are stored as plaintext.                                         | Decrypt only after ownership/consent checks; encrypt derived free-form output too.                             |
| [Weekly themes](../../src/server/weekly-reflection/repository.ts)                                               | SQL unnests plaintext AI themes. The provider receives compact statistics/themes, not a week of raw text.                                         | Replace theme-text SQL with bounded-memory service aggregation over decrypted analysis payloads.               |
| [Redis cache](../../src/server/analytics/cache.ts)                                                              | Analytics response JSON includes tag labels; keys are user/range/generation scoped and results expire after five minutes.                         | Encrypt cached response bodies or omit text-bearing cache data; hashing the cache key does not protect values. |
| [Mutation receipts](../../src/server/journal-sync/service.ts)                                                   | Atomic receipts persist a plain SHA-256 fingerprint of the normalized mutation and a compact result.                                              | A guessed short journal can be checked against the fingerprint. Protect fingerprints as well as content.       |
| [IndexedDB](../../src/features/journal/drafts/storage.ts)                                                       | Drafts, local snapshots, queue values, frozen payloads and discarded conflict operations contain plaintext.                                       | Server encryption does not cover these copies. An unlocked browser can read them.                              |
| [Exports](../../src/features/journal/VibeJournalApp.tsx)                                                        | Browser-generated JSON/PDF exports contain journal data.                                                                                          | Treat downloaded plaintext as an explicit user export, outside storage encryption.                             |

The cutover migration deletes migrated MoodEntry rows, but the legacy model still
exists. Audit its contents and every retained database snapshot during rollout;
this review did not inspect real journal data or verify backup/provider settings.
Infrastructure disk encryption, TLS configuration, logging, retention, and KMS
availability have not been established by reading the repository.

## Threat model

Assets: journal prose and titles; free-form tags; AI themes/reflection prompts;
local unsynced writing; encryption keys; wellness measurements; ownership and
version metadata. Trust boundaries are browser → authenticated application →
PostgreSQL/Redis, plus application → KMS and application → optional AI provider.

| Attacker or event                                                                | Intended protection                                                                        | Residual exposure / limit                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Read-only database credentials, stolen SQL dump or backup                        | Encrypted text, labels and receipt fingerprints cannot be read with database access alone. | Numeric wellness data, account identity, dates, entry counts, relationships and ciphertext sizes remain visible.                             |
| Redis-only disclosure                                                            | Encrypted analytics cache bodies hide labels and text.                                     | Key/range/access metadata remains visible; cache encryption is part of the target release, not provided today.                               |
| Database write access / ciphertext swapping                                      | Authenticated encryption binds ciphertext to its owner, record and purpose.                | Deletion, replay of an entire older valid row, and manipulation of plaintext analytics remain possible. This is not a tamper-proof database. |
| Cross-account API request                                                        | Existing server ownership checks remain mandatory before decrypting.                       | Cryptography does not replace authorization or prevent an application from returning the wrong already-decrypted DTO.                        |
| Compromised app process, deployment pipeline or decrypt-capable service identity | No confidentiality guarantee against this actor.                                           | It can obtain keys and plaintext. Least privilege and audit reduce exposure, not eliminate it.                                               |
| Malicious operator with both database and KMS permissions                        | No confidentiality guarantee.                                                              | Separating database, key administration and application permissions limits accidental access, not colluding privileged actors.               |
| XSS, malicious browser extension, unlocked/shared device                         | Outside the server-encryption guarantee.                                                   | DOM, memory, IndexedDB and exports can expose plaintext. A future local vault helps only while locked.                                       |
| Key loss, corrupted ciphertext or KMS outage                                     | Fail safely without writing plaintext or corrupting data.                                  | Protected reads/writes can become unavailable; permanent key loss makes data unrecoverable.                                                  |
| AI/provider disclosure after opt-in                                              | Not prevented by storage encryption.                                                       | Consented content leaves the application in plaintext over TLS. Provider retention and contracts require separate review.                    |

Authenticated encryption and key/data separation follow established guidance;
using a maintained cryptographic implementation is required rather than designing
a cipher. [OWASP cryptographic storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

## Field classification and analytics boundary

| Data                                                                                                  | Proposed representation                                                               | Reason / leakage accepted                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| title, content, voiceNote, photoNames, user-stored prompt                                             | One versioned encrypted JournalEntry private payload                                  | Free text and filenames may directly identify people or events. No plaintext preview column. Actual future media blobs need their own storage design.  |
| moodScore, energyScore, sleepHours, exercised, socialScore, categorical mood, stress, exerciseMinutes | Plain typed columns with existing constraints                                         | Supports SQL aggregation/filtering. These are still sensitive wellness data, not anonymous or harmless.                                                |
| userId, entry ID, createdAt, updatedAt, archivedAt, foreign keys                                      | Plain metadata                                                                        | Required for access control, pagination, ordering and concurrency. Dates and associations leak behavior.                                               |
| Tag.name                                                                                              | Encrypted label; random tag ID plus per-user keyed equality index                     | Preserve deduplication and grouping without exposing the label. Equality and usage frequency still leak.                                               |
| legacyTags                                                                                            | Remove plaintext array after cutover; derive legacy DTO tags from canonical tag links | Avoid a second unprotected copy. If retained temporarily, include it only in an encrypted legacy payload.                                              |
| JournalAnalysis themes/reflectionPrompt                                                               | Encrypted private analysis payload                                                    | Generated prose can repeat highly sensitive facts.                                                                                                     |
| primaryEmotion/emotions, sentimentScore, estimatedEnergy, confidence                                  | Plain typed, validated structured fields                                              | Supports current music criteria/structured calculations. Explicitly include this inferential data in the residual exposure disclosure.                 |
| sourceUpdatedAt, analysis IDs/dates                                                                   | Plain metadata, with source identity/version also authenticated                       | Preserve stale-analysis detection.                                                                                                                     |
| Mutation receipt payloadHash                                                                          | Encrypted fingerprint envelope; keep compact result/key metadata plain                | Prevent offline guessing of journal text from the existing unkeyed hash. Receipts must survive journal deletion.                                       |
| Redis analytics response                                                                              | Encrypt the complete serialized response envelope before SET                          | Avoid accidentally caching decrypted tag labels or generated text. Rate-limit blocks contain no journal content and need no content-encryption change. |

Tag design: normalize exactly as the current shared schema does, then compute
HMAC-SHA-256 with a separate, random per-user tag-index key. Store its version and
digest for `(userId, indexVersion, digest)` uniqueness. Do not use an ordinary hash,
global deterministic encryption, or the login/session secret. Aggregate by tag ID
and join decrypted labels in the service after obtaining counts. Preserve existing
minimum-observation rules. Keyed indexing still reveals repeated labels within an
account; an authorized query oracle and application compromise are outside the
DB-only protection. Index-key rotation needs a coordinated reindex/cutover to
avoid duplicate tags across versions, not just rotating encryption keys.

For weekly themes, keep arbitrary theme text encrypted. Fetch only eligible
analysis envelopes and metadata for the week in pages; decrypt and aggregate in a
server service with bounded memory. Enforce a workload budget; if exceeded, report
themes unavailable rather than silently returning a partial week's counts. Numeric
weekly statistics remain SQL-based. This adds computation and key access but avoids
inventing a new plaintext theme taxonomy or leaking free text.

## Encryption format and service placement

Proposed conceptual fields, **not an applied Prisma schema**:

- JournalEntry: `privatePayload`, `contentRevision`, plus the existing public
  structured columns. Final state removes plaintext sensitive columns.
- JournalAnalysis: encrypted private payload and revision; preserve numeric/code fields.
- Tag: encrypted label, index-key version and equality digest; retain tag/link IDs.
- UserContentKey: user ID, immutable key version, purpose, wrapped key bytes,
  wrapping-key reference, lifecycle state and creation/retirement dates. Only
  wrapped material is stored in PostgreSQL.
- JournalMutationReceipt: encrypted fingerprint envelope plus fingerprint format;
  existing metadata/result and account-scoped unique key remain unchanged.

Use AES-256-GCM with a fresh cryptographically random 96-bit nonce and full 128-bit
authentication tag for every encryption. The envelope contains a format version,
algorithm identifier, immutable DEK version, nonce, ciphertext and tag. Reject
unknown versions, invalid lengths, authentication failures and oversized payloads.
Never reuse a nonce under the same key; select a conservative per-key usage budget
and enforce/monitor rotation before production deployment. Do not use entry IDs,
timestamps, UUID strings, or idempotency keys as nonces.

Authenticate an unambiguous, versioned encoding of environment, authenticated user
ID, record ID, purpose and content revision as additional authenticated data (AAD).
Use separate purpose labels for journal text, tags, AI output, receipt fingerprints
and cache values. For AI include journal identity/source version; for receipts use
the operation key; for cache values use the user/range/generation identity. Build
expected identity from trusted call context, not solely envelope-supplied metadata.
AAD is authenticated, not hidden.

`contentRevision` is separate from `updatedAt`: logical edits retain current
optimistic concurrency semantics, but key rewrapping/reencryption must not make a
journal look edited or invalidate its AI analysis. Reencryption uses its own
compare-and-swap predicate so a rotation cannot overwrite a concurrent edit.
Numeric columns remain outside the encrypted payload; direct SQL analytics does
not authenticate them. Detecting arbitrary database tampering would require a
separate integrity design.

Proposed modules under `src/server/encryption`: envelope validation/codec,
key-provider interface, managed-KMS adapter and content-key lifecycle service.
Journal/analysis/tag/cache services call these explicitly. Prisma repositories
only read/write opaque ciphertext and metadata; no implicit Prisma middleware
that can be bypassed by raw SQL. React receives authorized plaintext DTOs and no
server DEK. Audit every use of serializeEntry and every full-row read, including
legacy APIs and exports, rather than changing only /api/journal.

## Key management

Use one managed symmetric wrapping key (KEK) per environment, and versioned,
random per-user, per-purpose DEKs (journal, analysis, tag labels, receipts and cache). The KEK remains within the KMS; the application receives
plaintext DEKs only long enough to perform approved operations. Prefer short-lived
workload identity with permission scoped to required KMS operations. Key admins
should not also have database/content-read privileges by default. The exact KMS
vendor, region and hosting identity integration are deployment decisions not
inferred from the current .env example.

A provider-neutral KeyWrapper interface should support generation/wrapping,
unwrapping and rewrapping. AWS KMS is one concrete reference, not a selected
vendor. Envelope encryption separates wrapping keys from data keys, allowing
rewrapping without reencrypting all content. [KMS envelope-encryption concepts](https://docs.aws.amazon.com/kms/latest/developerguide/kms-cryptography.html)

Bind wrapped keys to environment, pseudonymous user identifier, purpose and key
version via provider authentication context. Context may be logged by the provider:
never include journal text, titles, tag labels or email addresses. AWS explicitly
logs encryption context in plaintext. [KMS encryption context](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html)

Operational rules:

- Never derive DEKs from passwords, password hashes, AUTH_SECRET or provider API
  keys. Password reset and Google login must not change access to encrypted data.
- Cache unwrapped keys only in a bounded process-memory cache, keyed by user,
  purpose and version; proposed maximum lifetime five minutes. Never put them in
  Redis, cookies, logs, database plaintext, build artifacts or browser bundles.
  Revocation is consequently not instantaneous across workers; emergency response
  must evict/restart workers and revoke identities. JavaScript zeroization is best
  effort, not a reliable guarantee against process-memory capture.
- KEK replacement: rewrap DEKs when moving to a new wrapping-key identity. Provider
  internal key-material rotation may retain the same identity and decryption
  compatibility; follow its documented lifecycle. Retain tested recovery access until all live records
  and retained backups are covered. DEK rotation: issue a new version for new
  writes, reencrypt old payloads in batches and retain old decrypt versions until
  all references, receipts and backup requirements are satisfied. Never overwrite
  an immutable key version with different key bytes.
- Separate the tag-index key from content DEKs and rotate it through a dedicated
  reindex plan. Routine content-key rotation must not break tag deduplication.
- KMS failure: cached valid keys may operate until their short TTL; otherwise
  protected operations return a retryable unavailable error. Never silently store
  plaintext or return ciphertext as content. Offline queues retain work for retry.
  Pure numeric statistics may continue without keys; responses requiring decrypted
  text/labels fail clearly rather than fabricate blanks or silently incomplete data.
- Redis failure remains an optional-cache miss. If encrypting a cache body fails,
  skip caching; never cache plaintext. Existing invalidation and TTL behavior stays.
- Define key-access audits without plaintext payloads, alerts for unusual decrypt
  volume, quota/cost monitoring, recovery ownership and incident procedures. Test a
  restore with both database backups and appropriate KMS access before rollout.

Deleting a wrapped-key row is **not guaranteed cryptographic erasure**: backups
may contain the wrapped key and a shared KEK may still unwrap it. Account deletion
must handle live ciphertext, wrapped-key versions, caches and backup retention;
remote browser copies/exports remain outside that action. Strong immediate per-user
key revocation/erasure would need additional KMS/key-vault isolation and a recovery
policy. Do not promise it under this design. Key custody and recovery are explicit
operational obligations. [OWASP key-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

## Sync, receipts, AI and exports

Server encryption does not change the JSON form schema, stable client entry IDs,
queue ordering, idempotency keys, updatedAt checks or conflict choices. The server
validates plaintext, obtains keys and encrypts the private payload before the
repository stores it. Encrypted writes, structured changes, tag links and the
receipt still commit atomically. Avoid KMS network calls while holding database
transaction/advisory locks: prepare needed key material beforehand and recheck
receipt/version/ownership inside the transaction. A retry must compare the
canonical logical payload, not randomized ciphertext.

Encrypt receipt fingerprints even though they are hashes. Existing SHA-256 hashes
can be wrapped directly without needing the old journal text; retain their
normalization/hash format for replay checks. Decrypt a fingerprint only after
owner/key lookup, compute the same canonical request digest and compare in constant
time. This preserves old idempotency guarantees while removing a database-only
guess-testing surface. Receipt keys/results still reveal mutation metadata.

AI input is decrypted after the existing ownership and opt-in checks. Recheck
consent/version before persisting encrypted AI output as today. Encryption is not
consent; do not increase AI access or send wrapped keys. Weekly reflection keeps
its compact-summary policy. PDF/JSON export remains an explicit plaintext download
unless a separate encrypted-export format is later specified. Do not log decrypted
DTOs, request bodies, provider responses, failed validation values or SQL-bound
plaintext during migration. Client-side search on already-loaded authorized data
can continue; SQL substring/full-text search on encrypted prose cannot.

## Browser/offline storage: distinct security decision

The initial server scope leaves sensitive data in IndexedDB drafts, local snapshots,
mutation values, immutable payloads and discarded conflict operations. Account keys
are UI isolation, not encryption. Storing a raw encryption key next to ciphertext
would not address browser-profile theft; a nonextractable browser CryptoKey also
does not prevent same-origin code from using it. XSS can read/write IndexedDB.
[OWASP browser-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)

Recommended separate local-vault design: random per-user/per-device local data key,
wrapped using a distinct user-entered vault passphrase through a vetted,
benchmarked password-KDF and authenticated encryption. Persist only the wrapped
key, salt, KDF parameters and encrypted record bodies. Keep routing metadata such
as owner, entry ID, operation ID, order, status and version outside the body; bind
it to the ciphertext where immutable, and use fresh nonces for changed records.
Choose the KDF/library and parameters in that phase's compatibility/security review,
not by reusing the login password or server DEK.

Unlock is required after refresh/restart. All draft/queue copies, including discarded
payloads, must be migrated; encrypting only localEntries is insufficient. A locked
vault pauses replay until unlocked and must never mark entries synced. Sync decrypts
locally and sends normal authenticated requests over TLS; the server applies its
own encryption. Forgotten vault passphrases can lose unsynced writing unless an
explicit recovery mechanism is designed. Locking protects stored copies while
locked, not an actively compromised browser. This changes today's automatic draft
recovery/background replay UX and requires an explicit product decision.

## Migration and validation plan

1. Confirm scope and KMS deployment decisions; inventory current data/legacy tables,
   cached text, logging sinks and backup retention without dumping journal text.
2. Add encrypted payload/key metadata fields and explicit compatibility readers.
   Newly upgraded writes produce encrypted private fields and clear their plaintext
   copies atomically. Coordinate deployment so an older writer cannot repopulate
   plaintext; do not roll back to plaintext-only binaries after this cutover.
3. Backfill in bounded, resumable batches with content/version compare-and-swap.
   Round-trip verify before clearing plaintext. Preserve entry IDs, timestamps,
   ordering, AI sourceUpdatedAt and receipt results. Reindex tags without duplicating
   user/tag links. Protect AI payloads and receipt digests in the same rollout.
4. Switch all consumers: both CRUD services, sync, dashboard, current-user/export,
   journal/AI detail, weekly themes and tag analytics. Rotate the Redis cache
   namespace and expire/delete old plaintext bodies. Remove unneeded legacy copies.
5. Require encrypted-only reads/writes for migrated records. Authentication failure
   never falls back to a stale plaintext column. Drop sensitive columns/constraints
   only after completeness verification and rollback/recovery rehearsals.
6. Account for WAL, replicas, dead row versions, snapshots and old backups: dropping
   columns is not secure deletion. Track when retained plaintext copies expire;
   do not claim historical protection before that date.

Acceptance checks before any production cutover:

- Correct round trips, Unicode/empty/null fields, schema/length limits, distinct
  nonce/ciphertext for repeated plaintext, and key-purpose separation.
- Reject modified ciphertext/tag/nonce, cross-user/record/context swapping, unknown
  key/envelope versions, missing keys and malformed envelopes without logging text.
- DB/Redis inspection tests find no fixture prose, titles, tag labels, AI prose or
  unprotected receipt fingerprints after migration. Numeric outputs remain correct.
- Unchanged pagination, tag counts/uniqueness, AI consent/staleness behavior and
  authorized export; bounded decrypt work for history/dashboard/weekly summaries.
- Sync lost-response/concurrent replay, conflict resolution and delete receipts
  remain correct despite fresh encryption nonces, key rotation and KMS errors.
- Backfill versus concurrent edit/delete races, fail/resume, old-writer exclusion,
  key rotation during writes, backup restore and account deletion retention.
- KMS/Redis outages and corrupt records never create plaintext writes, data loss,
  false successful sync, or silently inaccurate analytics.

## Decisions to confirm before implementation

1. Accept server-readable encryption as the intended guarantee, or choose a separate
   end-to-end design. Recommendation: server-readable encryption for the current app.
2. Accept numeric wellness/identity/timestamp/equality leakage in exchange for SQL
   analytics. Recommendation: leave numeric/code fields queryable, encrypt free text.
3. Select the actual KMS provider, region, workload-identity integration, recovery
   owners and retention policy. No production provider has been selected here.
4. Decide whether release scope is server storage only with explicit browser-copy
   disclosure, or includes the local vault and its unlock/recovery UX. Recommendation:
   implement the server boundary first, with the local vault as a separately reviewed
   feature; do not market this as protecting all stored journal copies.

This document is a reviewable proposal. It does not authorize key destruction,
production migration, or a change to user-visible privacy guarantees by itself.
