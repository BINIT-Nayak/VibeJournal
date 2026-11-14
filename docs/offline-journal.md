# Offline journal creation

An already-loaded create editor can save a validated journal entry without a
network connection. Dexie database version 2 adds localEntries while preserving
version 1 drafts. Each entry receives a browser-generated crypto.randomUUID ID,
account owner, form values, local creation timestamp and durable sync status.
The form returns immediately after IndexedDB commits; upload runs separately.

- pending: saved on this device, awaiting connectivity/upload.
- syncing: a tab holds a time-limited upload claim; local data remains intact.
- synced: the server confirmed the same stable ID.
- failed: upload could not be confirmed; data remains locally available with Retry.

The local entries panel appears on New Journal and Journal History. It offers
local reading, status, retry, and a link once the server confirms the entry.
Pending uploads resume when either page mounts, when connectivity returns, or
on a one-minute recovery sweep while mounted. Failed attempts require explicit
retry. A transactional 60-second lease prevents tabs uploading the same entry
concurrently; crashed claims expire. Requests have a 30-second timeout. A stale
attempt cannot overwrite a later attempt's status.

POST /api/journal accepts an optional UUID clientEntryId. The existing primary
key enforces uniqueness; concurrent creates or retries after a lost response
return the same user-owned record without creating duplicate tags or rerunning
AI analysis. First successful creation wins; this is not an update operation.
A collision with a foreign account fails without exposing its entry. Uploads
include X-Local-Journal-Owner as an account-match assertion; the server still
uses only its authenticated session to determine ownership. Switching accounts
cannot upload one account's queued content into another account. Normal payload
validation, authentication, origin checks, and AI consent remain in force.

Scope and limits:

- Create uploads only; no offline edit/delete sync, conflict merging or background
  worker. The editor must already be loaded before going offline. Opening or
  refreshing the app entirely offline is not supported without a cached app shell.
- Closing the tab retains committed local entries but pauses uploads until the app
  is opened online again. Browser eviction/clearing site data removes local data.
- Local records are not separately encrypted. Account keys isolate UI access, not
  access by someone controlling this browser. Synced local copies are retained;
  they are creation snapshots and do not mirror later server edits/deletions.
- Server createdAt records the server commit time; local createdAt retains when the
  entry was saved on this device. Backdating server history is not implemented.
- If IndexedDB is unavailable, online creation still works. Offline creation then
  shows an error and keeps the current editor open instead of claiming a save.
- An unconfirmed upload whose server record is independently deleted before retry
  can create that ID again; deletion tombstones belong to a future full sync model.

Run scripts/test-offline-journal.mjs with a local app/database, Chrome, and
Playwright (PLAYWRIGHT_MODULE may point to its installation). It tests offline
commit, stable IDs, tab-close retention, reconnect, lost-response retry, concurrent
idempotency, account assertions and expired-lease recovery. Existing draft browser
tests also cover IndexedDB-unavailable online saves and stale edit protection.
