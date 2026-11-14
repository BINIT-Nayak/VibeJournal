# Local journal drafts

The shared JournalEditor uses Dexie/IndexedDB for drafts in create and edit flows.
Storage and recovery live under `src/features/journal/drafts`. One draft is kept
per authenticated account and entry (plus one new-entry draft), isolated by a
compound JSON key. No draft content is sent to the server until Save is pressed.
Unsaved drafts do not sync. Pressing Save in the create flow now commits a local
entry for upload; see [offline creation](offline-journal.md). No service worker or
full offline application shell is included.

The editor loads a draft before enabling input, restores incomplete/invalid form
values without applying submission constraints, and writes on every form change.
Writes are serialized; cleanup waits for outstanding writes before deletion.
Status text distinguishes local draft storage from a successful journal save.
Successful edit saves clear the draft; failed edits retain it. New-entry drafts
are cleared only after their content has been committed to the local entries table
(or saved online if local storage is unavailable). Upload failures retain the
committed local entry for retry. Explicit discard and confirmed cancellation remove the local draft.
Tags and optional mood/context fields are restored alongside title/content.

Edit drafts retain their original server updatedAt timestamp. Recovery never
rebases it silently onto a newer entry; existing optimistic concurrency checks
reject stale saves. The user can review the saved entry or discard and reload.

Drafts remain on the browser after logout but are not shown to another account.
They are not encrypted separately from the browser's storage; avoid shared devices.
Clearing site data, browser eviction/private-mode cleanup or device failure can
remove drafts. The “saved on this device” status appears only after a completed
IndexedDB write. Immediate process termination can interrupt a pending write.
Multiple tabs editing the same draft use last-completed-write wins; collaborative
editing is not implemented. Storage failure shows a warning and does not prevent
editing or saving to the server. Local deletion failure likewise cannot undo a
successful server save, so a leftover draft may need explicit discard later.

The schema follows [Dexie's TypeScript API](https://dexie.org/docs/Typescript).
No server database migration or environment setting is needed.

Run `node scripts/test-journal-drafts.mjs` with the local app/database running,
Chrome installed and Playwright available (or set PLAYWRIGHT_MODULE to its module
path). The browser test uses disposable accounts and covers refresh/tab closure,
tags, failed-save retention, successful-save cleanup, stale edits, discard,
account isolation, and server saving when IndexedDB is unavailable.
