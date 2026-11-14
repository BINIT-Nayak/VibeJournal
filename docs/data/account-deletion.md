# Account deletion

Settings → Delete account permanently opens a keyboard-accessible confirmation
dialog. Cancel and Escape leave the account untouched. The user must type the
exact word DELETE and verify their identity before the final destructive action.

Password accounts submit their current password. The server verifies its secure
hash; a logged-in session alone is insufficient. Google accounts initiate a new
Auth.js Google authorization flow, requesting account selection and max_age=0.
The verified Google subject must match the account that started verification.
A random 256-bit, HttpOnly, SameSite=Lax cookie identifies a hashed database
challenge. Verification expires after five minutes and is consumed atomically
with deletion. A query parameter or client-side verified flag cannot authorize it.
Google controls its own authentication screens; VibeJournal never requests the
Google password.

DELETE /api/account accepts only:
{ "confirmation": "DELETE", "password": "current password" }
The password is omitted for Google accounts with a verified deletion challenge.
The account identity always comes from server authentication, never the payload.
JSON requests require the configured same Origin. Attempts are limited to five
per fifteen minutes per account. A concurrent change to credentials or email
invalidates password verification.

## Data removed

A single PostgreSQL transaction deletes the User and its FK-cascaded:

- JournalEntry, JournalAnalysis, JournalTag and Tag rows;
- UserSettings, including AI consent and music preferences;
- PlaylistRun music history and legacy MoodEntry rows;
- all Session and PasswordResetToken rows;
- JournalMutationReceipt offline idempotency receipts;
- UserContentKey wrapped encryption keys;
- AccountDeletionChallenge verification records.

Known throttle records derived from the current account ID and email are removed
in the same transaction. Historical throttle hashes tied to an earlier email are
not reverse-identifiable; they contain no email or content. Other users' records
are untouched. FK ownership constraints prevent late journal/AI writes from
recreating child records after their owner has been deleted.

Auth.js checks the server session on every request, so deleting Session rows
revokes previously issued cookies across devices. Cookie cleanup is best effort
after commit; its failure cannot resurrect an account or report a rollback.

The handling process clears its in-memory encryption key cache. Other processes
resolve keys through the now-deleted database rows and fail closed. Unwrapped
buffers already held by in-flight operations may survive until their operation
finishes or their five-minute cache TTL expires.

Analytics generations are invalidated and matching Redis analytics/rate-limit
keys are removed when Redis is available. Redis outages do not prevent database
deletion. Residual analytics ciphertext is unusable without the deleted wrapped
keys and expires within its five-minute TTL; throttle denials expire within their
policy windows. Redis cleanup is not a distributed secure-erasure guarantee.

## Browser and external copies

After server confirmation, this browser clears the account's Dexie drafts,
local journal entries, sync mutations and TanStack Query cache. A BroadcastChannel
notifies other open tabs to clear the same account and leave protected screens.
The process preserves other accounts' IndexedDB records. Pending local draft
writes and new queue claims are stopped in notified tabs. Cleanup failure is
reported separately with a retry action: server deletion is not presented as
undone.

An offline device, a suspended tab that misses the notification, an existing
download, or a browser without accessible storage cannot be remotely erased.
Users must clear those copies on the relevant device. Server authentication still
rejects their old sessions; queued mutations cannot restore the deleted account.

Database backups, WAL, snapshots and provider logs follow the deployment's
retention policy. This feature removes live application records; it cannot
selectively erase immutable historical backups or previously sent AI-provider
requests. Operators must expire backups and ensure a restored backup does not
reactivate deleted accounts. Do not promise immediate erasure from backups.

## Verification

npm run test:account-deletion uses disposable accounts to check confirmation,
password failures, CSRF, account isolation, all table cascades, session revocation,
Google proof expiry/ownership/single use and throttling. npm run test:auth covers
existing login/reset/session behavior.

scripts/test-account-deletion-browser.mjs uses Playwright to check the dialog,
keyboard cancellation, focus return, error feedback, IndexedDB cleanup and
cross-tab sign-out. Set PLAYWRIGHT_MODULE to an installed Playwright module when
it is not a project dependency. The Google identity/authorization flow requires
configured Google credentials for live provider verification; proof validation
and deletion authorization are tested locally.
