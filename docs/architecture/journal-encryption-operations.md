# Journal encryption implementation and operations

The selected production provider is AWS KMS. The server uses AES-256-GCM with a
fresh 96-bit nonce and 128-bit authentication tag. A versioned envelope binds the
environment, owner, purpose, record ID, content revision and data-key ID as
authenticated additional data. Invalid envelopes, unavailable keys and failed
authentication return sanitized errors. There is no plaintext fallback.

## Protected data

Journal title, content, voice-note text, photo names and prompt are encrypted as
one payload. Tag labels are encrypted separately; a per-user HMAC key provides an
opaque equality index. AI themes/reflection prompts and sync request fingerprints
are encrypted too. Analytics Redis bodies use a new encrypted v2 namespace.
Mood, energy, sleep, exercise, categorical emotions, timestamps and relationships
remain queryable. Authorized responses still contain decrypted text.

Per-user, per-purpose data keys are wrapped by KMS and stored in PostgreSQL.
Unwrapped keys are cached for up to five minutes, with at most 200 entries per
process. Cache eviction clears key buffers on a best-effort basis; JavaScript
cannot guarantee memory erasure. A KMS outage can leave already cached keys usable
until expiration. New access without a usable key fails closed.

## Production configuration

Set these server-only variables (never NEXT_PUBLIC):

- JOURNAL_KEY_PROVIDER=aws-kms
- JOURNAL_ENCRYPTION_ENV: stable, unique deployment identity; changing it breaks reads.
- AWS_REGION and JOURNAL_KMS_KEY_ID: region and immutable symmetric KMS key ARN.
- JOURNAL_DATA_KEY_VERSION=1 initially.
- JOURNAL_KMS_PREVIOUS_KEY_IDS: comma-separated previous ARNs during rotation.

Use the AWS SDK workload-role credential chain. Grant only kms:GenerateDataKey
and kms:Decrypt for approved keys; restrict encryption context in the IAM/key
policy to the intended environment and purposes. Do not put AWS credentials in
client variables or commit them. Encryption context contains pseudonymous owner
IDs, purpose and environment, and can appear in AWS audit logs; it contains no
journal text. Keep application/APM request and response body capture disabled for
journal, sync, AI and export routes. Do not log caught encryption/provider errors.

A configured development-only wrapping key is supported in ignored .env.local.
It must be 32 random bytes, base64 encoded. The development provider refuses to
operate under NODE_ENV=production. Preserve that local key with local database
backups; generating a replacement will not decrypt existing data.

## Cutover

Use a maintenance window. Stop old writers, configure keys, take a recoverable
backup, run prisma migrate deploy, then npm run encryption:backfill with
NODE_ENV=production in production. Start the upgraded application only after
backfill succeeds. Reads intentionally reject unmigrated content.

The backfill uses bounded batches, round-trip verification and conditional writes,
preserves journal timestamps/revisions used by sync, clears plaintext copies, and
validates database constraints. It is resumable after interruption. A legacy
MoodEntry population stops the process and must be migrated first. Constraints
reject plaintext writes immediately, including writes from older application
binaries. Do not roll back to a plaintext-only version after cutover.

The previous Redis namespace expires after its existing five-minute TTL.
PostgreSQL WAL, dead tuples, replicas and historical backups can retain earlier
plaintext: apply your backup retention and recovery policy. Migration does not
constitute secure erasure of those historical copies.

## Rotation and recovery

KMS automatic backing-key rotation retains decryptability behind the same ARN.
For a new KMS key ARN, retain the old ARN in the allowlist and increment
JOURNAL_DATA_KEY_VERSION for new content writes. Old envelopes reference their
stored data-key IDs and remain readable while their KMS keys are accessible.
Tag indexing deliberately stays at version 1 to preserve equality; changing its
key requires a coordinated reindex. There is no automated historical rewrap or
bulk content re-encryption command yet. Do not revoke old keys before that work
and a restore rehearsal. No automatic data-key usage ceiling or scheduled
rotation is implemented; monitor use and rotate before unusually high volume.

Account deletion cascades stored wrapped keys; retained backups and five-minute
in-process key caches are separate retention considerations. Test restoration of
both database and KMS access before production launch. Losing wrapping-key access
can make journal data permanently unreadable.

## Validation and limits

npm run test:encryption covers encryption/decryption, nonce freshness, tampering,
context substitution, malformed envelopes, missing/wrong keys and sanitized
failures. It also exercises the AWS adapter using a mocked SDK transport.
node --conditions=react-server scripts/test-encryption-persistence.mjs exercises
real PostgreSQL using a disposable account.

Actual AWS KMS/IAM access requires deployment credentials and has not been
live-verified locally. Production cutover/recovery rehearsals remain deployment
work. This protects server storage against database-only disclosure; it is not
end-to-end encryption and does not protect a compromised application server,
authorized AI-provider input, authenticated browser responses or plaintext
IndexedDB drafts/offline queues. Browser-vault encryption remains a separate task.
