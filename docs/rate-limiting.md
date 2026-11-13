# Server-side rate limits

The shared server-only limiter uses atomic PostgreSQL upserts in the existing
AuthRateLimit table. Its historical table name now also covers AI and music.
Optional Redis caches exhausted buckets to absorb repeated blocked requests;
PostgreSQL remains the durable counter, so an outage never resets quotas.
No new migration is required. See [Redis infrastructure](redis.md). HMAC keys contain no plaintext email,
user ID, token, or journal content; AUTH_SECRET must remain stable across instances.
Database time defines fixed windows. Denied requests do not extend the window,
and counters are capped to avoid unbounded integer growth.

| Scope                                      | Identity                             | Limit             |
| ------------------------------------------ | ------------------------------------ | ----------------- |
| Credentials login                          | Normalized email                     | 10 per 15 minutes |
| Registration                               | Normalized email                     | 5 per 15 minutes  |
| Password-reset request                     | Normalized email                     | 5 per 15 minutes  |
| Reset confirmation before password hashing | Account owning the valid reset token | 5 per 15 minutes  |
| AI journal + weekly generation combined    | Authenticated user                   | 5 per 15 minutes  |
| Weekly AI generation, additional cap       | Authenticated user                   | 3 per hour        |
| Music catalog recommendations              | Authenticated user                   | 20 per minute     |

Authentication limits apply regardless of whether an email exists. The credentials
provider itself enforces login limits, so direct Auth.js calls cannot bypass them.
Custom auth endpoints and the Auth.js credentials callback return explicit 429
responses instead of redirect-only rate-limit errors. These are account-based
limits; no untrusted forwarded-IP headers are used as identity. Network-wide
volumetric protection remains a deployment concern.

AI limits apply after consent/ownership and eligibility checks but before provider
creation or invocation. Weekly generation consumes its hourly scope, then the
shared AI scope. Valid attempts that fail configuration/provider validation still
count. An earlier scope may be consumed when a later scope denies the request.
Music limits apply after request validation and source/energy checks, before
the provider call. Preview and preference reads do not consume provider quotas.
Client-provided user IDs cannot select another user's bucket.

Throttled responses have HTTP 429, Retry-After in seconds, private/no-store,
and RATE_LIMITED with a readable message and retryAfter. Legacy auth responses
retain their string error field for existing forms; their code/retryAfter are
top-level. Other endpoints use the typed error object. Limiter database failures
fail closed: they do not allow an external provider call.

## Journal-save behavior

Automatic analysis is best effort. Its shared AI quota does not prevent writing a
journal: creation remains HTTP 201 and entry.analysisStatus is rate_limited when
analysis was throttled. The saved entry is not rolled back. Normal outcomes are
saved, skipped or failed.

POST /api/journal/[id]/analysis allows an explicit analysis attempt for an owned
entry. It checks consent, validates/stores the result, and returns 429 when
throttled. It does not accept user IDs or journal text in the body. An edited,
archived or nonconsenting source is not analyzed or persisted; provider failures
do not affect the journal. The existing weekly/music clients display rate-limit
messages and do not automatically retry provider failures.

## Operations and tests

Expired rows are reset lazily on reuse. Periodically remove long-expired rows
using the indexed resetAt column if the identity table grows; current rows must
not be cleared, as doing so resets quotas.

Run npm run test:rate-limits against the local app/database. It uses disposable
users and keys to test parallel consumption, fixed windows, expiry, isolation,
auth/native Auth.js 429s, AI/music headers, shared AI caps and successful journal
saving while analysis is blocked. No real AI/music requests are made.
Other provider/persistence tests explicitly stub quotas to test their independent
behavior; the quota suite uses the real database limiter.
