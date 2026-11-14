# Privacy-conscious security audit

SecurityAuditEvent stores security events in PostgreSQL. It is server-only and
has no public query or ingestion API. Callers use recordAuditEvent with a strict
runtime Zod allowlist; unrecognized fields and arbitrary messages are rejected.
Database CHECK constraints also restrict event names, outcomes and metadata.

## Stored fields

- id: generated event identifier.
- createdAt: server-generated UTC timestamp.
- event: login, logout, password.change, password.reset, data.export,
  account.delete or ai.preference.
- outcome: requested, succeeded, denied or failed.
- userId: nullable opaque application account ID, sourced from server identity
  lookup/session only. It is pseudonymous, not anonymous, while linked.
- reason: optional fixed category, never a caught exception or user message.
- provider: credentials or google for login events only.
- enabled: boolean for AI preference updates only.

No journal content, titles, tags, AI text, tracking values, music preferences,
names, email addresses, passwords/hashes, reset/session/OAuth tokens, cookies,
encryption keys, request/response bodies, query strings, URLs, IP addresses or
user-agent strings enter audit payloads. No free-form metadata field exists.
Unknown-account credential failures have no identifier.

## Event semantics

Successful logins and logouts are recorded at Auth.js events, including its
standard routes; the custom login route does not duplicate successful events.
Credential rejection and throttling are recorded in the credential provider.
Custom-route origin/input rejection is recorded without submitted identities.
Google login success is recorded after provider verification; upstream Google
denials that never complete the Auth.js callback are not inferred.

Password changes are recorded after the password write commits; rejected current
passwords and reset tokens are recorded with fixed reasons. Reset tokens are
never stored in audit rows. AI preference events record a successfully committed
setting value; setting the same value again also produces a successful update
event, not a claim that the value changed. Other preferences are not audited.

Exports record requested and succeeded/denied/failed outcomes. Success means the
server assembled the response, not proof that the browser saved the file.
Deletion requests and rejected attempts are linked while the account exists.
Account deletion cascades all its linked audit records. After commit, a new
deletion-succeeded event contains no user ID or other account identifier.
The event time can still be correlated with outside information; this is not a
claim of anonymity against external logs.

Users' JSON data exports include their own retained securityAuditEvents with
timestamp, event, outcome and limited metadata. Other accounts' and anonymous
events are never included. The export-request event can appear in its snapshot;
its completion event necessarily happens after that snapshot.

## Retention and availability

Retention is 30 days. Successful writes opportunistically remove older rows at
most hourly per process. Schedule npm run audit:prune daily in deployment to
enforce cleanup during low traffic; no scheduler is installed automatically.
The script logs only a deletion count or a fixed failure notice. Backups follow
the deployment's retention policy and are not selectively erased by pruning.

Logging is awaited, but a storage or validation failure does not change the
business operation's outcome. A fixed diagnostic, "Security audit recording
unavailable.", is emitted at most once per minute per process. It contains no
event payload or exception. Configure monitoring on that diagnostic and on the
scheduled retention job. Events can be lost during outages or a process crash
between the business commit and the audit insert; this is not a transactional
outbox or a compliance-grade immutable ledger.

Restrict database/operator access to audit rows and encrypt backups. A privileged
database administrator can modify this table; no tamper-evident external sink is
provided. External logging/APM request-body collection must also be disabled for
sensitive endpoints; the application logger cannot sanitize an independent proxy.
Anonymous request events may be high-volume during abuse: deployment ingress
controls and storage monitoring remain necessary.

## Tests

npm run test:audit checks payload allowlisting, safe diagnostics, retention
cutoffs, deletion anonymity and audit-storage failure behavior without a database.
npm run test:audit-events uses a disposable account to verify login/logout,
password changes/reset, AI updates, export outcomes, absence of private values,
and deletion of linked audit history.
