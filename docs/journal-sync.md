# Persistent journal mutation queue

IndexedDB version 3 separates `mutations` from local entry snapshots and drafts.
Each operation has a stable UUID idempotency key, account, entry ID, increasing
sequence, create/update/delete kind, payload, retry metadata and status. Enqueue
updates the local snapshot and queue in one Dexie transaction. Version 2 pending,
failed or interrupted creates migrate into create operations; drafts are preserved.

The account-scoped runner mounts in the application layout. It wakes on enqueue,
connectivity return, application load and a 15-second timer. No upload depends on
React component render state. A transactional 60-second lease claims operations
across tabs, and only that attempt can settle its status. A network call times out
after 30 seconds. Closed-tab leases can be reclaimed without changing their key.

Operations replay in sequence per entry; a failed predecessor blocks only that
entry. Other entries can continue. Updates/deletes behind an acknowledged operation
use that receipt's updatedAt. The resolved request payload is persisted before the
first send and remains immutable across retries. Independent edits retain the
version seen by their editor; remote changes produce a conflict, never a silent
last-write-wins overwrite.

Transient network/408/429/5xx failures retry with exponential backoff (capped at
five minutes), respecting Retry-After. Authentication, authorization, invalid
payloads remain failed for user review/manual retry. Version mismatches and
missing entries use a dedicated conflict state; see [conflict resolution](journal-conflicts.md). The UI retains local content, exposes status and review links, and clearly
marks queued deletion. Conflict resolution requires an explicit choice after reviewing both versions.
Subsequent operations on a conflicted entry stay blocked until that choice.

## Server protocol

POST /api/journal/sync receives one strict Zod-validated operation. `key` is the
idempotency key; `entryId` identifies the journal. Updates/deletes require
expectedUpdatedAt. The X-Local-Journal-Owner header must match the authenticated
session; it never supplies authorization. Normal origin and ownership rules apply.

PostgreSQL advisory transaction locks serialize the same key and target entry.
The journal mutation, tag writes and JournalMutationReceipt commit atomically.
Receipts store an account-scoped key, normalized-payload hash and compact result
(entry ID, resulting version, deletion flag), not journal content. Repeating a key
returns its original result; reusing it with different content returns 409.
A delete receipt remains after its entry is deleted. Replaying an earlier create
cannot resurrect that entry. Receipts cascade only on account deletion and have
no TTL: pruning them would weaken the replay guarantee.

Analytics invalidation and best-effort, consent-gated AI analysis happen after
commit. AI is invoked only on the first successful creation, not on receipt replay.
A process crash after commit can skip those best-effort side effects; it cannot
lose the receipt or double-apply the journal write.

Migration: `20261114090000_journal_sync_receipts`. Run `prisma migrate deploy` and
regenerate Prisma when deploying. Redis is not involved in queue correctness.

## UI and limits

New entries, edits and confirmed deletions use the queue. The local entries panel
also lets users edit a pending creation or queue its deletion. A queued change is
not presented as confirmed on the server until acknowledgement. Edits and deletes
require browser storage; if unavailable, their current UI stays open with an error.
Online creation retains its existing direct-server fallback when IndexedDB fails.
Legacy REST endpoints remain available for existing clients.

The app must already be loaded before going offline. There is no service worker,
offline app-shell loading, background sync while closed, cross-device download or
automatic conflict merge. Synced local snapshots and queue receipts remain on this
browser; they do not mirror subsequent changes from other devices. Browser data
clearing/eviction removes unsynced work. Server receipts survive browser clearing.

## Checks

With the local app/database running and Chrome/Playwright available:

- `node scripts/test-journal-sync.mjs` (or set PLAYWRIGHT_MODULE) checks ordered
  create/update/delete, response loss, concurrent replay, payload mismatch,
  account checks, version chaining, rollback on conflict, expired leases,
  tab-close recovery, and migration from IndexedDB version 2.
- `node scripts/test-journal-drafts.mjs` checks draft restoration and isolation,
  local-first save flow, conflict preservation and storage-unavailable creation.
- `npm run check`, `npm run typecheck`, `npm run build` validate the application.
