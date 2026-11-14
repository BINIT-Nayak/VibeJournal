# Offline journal creation

Offline creation now uses the [dedicated mutation queue](journal-sync.md), which
also supports ordered offline updates and deletes. The create-only uploader and
version 2 localEntries schema are migrated automatically to IndexedDB version 3.

An already-loaded editor can commit a validated entry without a connection. Its
stable browser-generated UUID remains the server journal ID. The UI reports
pending, syncing, synced or failed, retains local content until acknowledged, and
allows retries. Each upload operation also has its own immutable idempotency key.

See the queue documentation for ordering, transaction receipts, retry policies,
conflicts, account isolation, browser-storage limits and tests. No offline app
shell or upload worker running after the browser closes is included.
