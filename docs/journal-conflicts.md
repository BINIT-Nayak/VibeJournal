# Offline conflict detection and resolution

Queued update/delete operations retain the server updatedAt they were based on.
The server compares that version and also applies a conditional write in the same
transaction. A mismatch returns HTTP 409 with VERSION_CONFLICT. Missing/foreign
entries remain indistinguishable 404 responses; clients treat missing targets for
updates/deletes as a conflict rather than repeatedly retrying them.

IndexedDB persists `conflict` on the operation and local entry. The worker skips
conflicts even during manual retry, blocks dependent operations for the same
entry, and continues unrelated entries. Local content is retained. New changes
cannot be appended to that entry until the conflict is resolved. Generic key reuse
409 errors remain failures; they are not mistaken for version conflicts.

The local entries panel offers Review conflict. A fresh, owner-checked request
loads the current server version and shows it alongside the latest local content,
mood, energy, sleep, exercise, social score and tags. No offline/network error is
treated as a deletion. Resolution requires connectivity and confirmation:

- Keep server version: discard all unsynced changes for this entry and adopt the
  reviewed server snapshot. This also cancels a conflicted queued deletion.
- Keep my version: replace the blocked chain with a new update using the reviewed
  server version and a fresh idempotency key. Queued deletion instead requires an
  explicit Confirm deletion of server version action.
- For a missing server entry: accept the deletion or save local content as a new
  entry with a new stable ID. The old ID is never resurrected.

Immediately before resolving, the client rereads the server version. If it changed
since the comparison, the user must reload the comparison. Local resolution is an
atomic Dexie transaction checking the conflict key, the whole pending chain and
local snapshot; a concurrent tab cannot silently resolve an outdated review.
Discarded operations keep their original immutable payloads/keys for local audit
but are never replayed. A new write remains conditionally versioned on the server,
so another server change between review and upload produces another conflict.
There is no force-write or automatic text merge.

No database/index migration is required for these additional status values.
Older clients' generic failed conflicts can be retried once to receive the new
VERSION_CONFLICT response and enter the dedicated flow. Discarded payloads remain
in this browser's queue storage until its site data is cleared; this is not a
cross-device backup.

`node scripts/test-journal-conflicts.mjs` (with Chrome and Playwright, optionally
PLAYWRIGHT_MODULE) verifies pause/reload, comparison, a server change during review,
keep-local with a new key, keep-server, conflicted deletion cancellation and
recovery after remote deletion. The queue and draft regression tests also cover
the new conflict status.
