# Authentication

Auth.js is active with its Credentials provider. The pinned v5 package uses JWT
sessions as required by [the Credentials provider](https://authjs.dev/getting-started/authentication/credentials).
Registration is application-owned; Auth.js verifies credentials and issues the
encrypted HttpOnly, SameSite=Lax cookie. HTTPS deployments use Secure cookies.

## Configuration

- `DATABASE_URL`: PostgreSQL connection used by Prisma.
- `AUTH_SECRET`: a private random secret, generated once per environment with
  `openssl rand -base64 48`. Keep it stable across restarts and identical across
  instances. Rotating it invalidates all existing Auth.js cookies.
- `AUTH_URL`: exact application origin, such as `http://localhost:3000` locally or
  the HTTPS public origin in deployment. Reverse proxies must preserve that origin.

Apply migrations with `npm run prisma:deploy` and regenerate with
`npm run prisma:generate` before running this version. The new `AuthRateLimit`
table is additive. Existing users, passwords, and journal entries are preserved.
Legacy session cookies are no longer accepted, so users sign in again once.

## Endpoints and boundaries

- `POST /api/auth/signup`: validates email/password/name, creates the account and
  settings, then signs in through Auth.js. Duplicate email returns 409. Supplied
  IDs and unknown registration fields are ignored.
- `POST /api/auth/login`: verifies credentials through Auth.js; returns public user,
  settings, and journal data. Bad credentials have one generic error response.
- `POST /api/auth/logout`: revokes the server session and clears cookies.
- `GET /api/auth/me`: validates the session and reloads the current user from the
  database; returns `{ user: null }` when anonymous. Responses are not cached.
- `/api/auth/[...nextauth]`: Auth.js providers, CSRF, callback, and session endpoints.
  Its built-in CSRF protection remains enabled.
- `/login` and `/register` share the auth layout and password controls, with React
  Hook Form and Zod validation. Successful authentication redirects to `/dashboard`.
- `/dashboard` verifies the session on the server before rendering the journal.
  `/` redirects to `/dashboard` when authenticated and `/login` otherwise.
- `/forgot-password` preserves the existing recovery flow. Authenticated visitors
  to auth pages are redirected to `/dashboard`.

Custom JSON mutation endpoints require `Content-Type: application/json` and an
`Origin` matching `AUTH_URL` (or the request origin locally). This protects custom
routes that invoke Auth.js's server-side signIn/signOut helpers. API clients must
send the Origin header too. Protected API handlers derive the user from `auth()`
and a database lookup; no body, query string, or session-update user ID is trusted.

## Passwords and sessions

New passwords are 8–128 characters, hashed with scrypt (`N=131072`, `r=8`, `p=1`),
a random 16-byte salt, and a 64-byte derived key. Comparison is constant-time.
Existing salt:hash passwords remain supported and upgrade after successful login.
Passwords and hashes are never returned in auth responses or included in cookies.

Auth.js JWTs contain a random session identifier whose hash is stored in the
existing `Session` table. Every session check verifies that row, its owner, expiry,
and a server-derived password-version fingerprint. Sessions expire after 30 days
and are not silently extended past that server expiry. The session identifier and
password fingerprint are not exposed by the public session callback.

Logout revokes the current session, even if its cookie is replayed. Password changes
and resets revoke all sessions; account deletion also cascades to sessions. Reset
tokens are hashed, expire after 30 minutes, and are consumed atomically once.
Client session-update payloads cannot change identity or bypass revocation.

## Throttling and recovery

PostgreSQL atomically limits normalized-email login attempts to 10 per 15 minutes,
and registration/reset attempts to 5 per 15 minutes. Keys are HMACs, not raw emails.
The shared table works across app instances without Redis. Deployments should also
enforce request-size and network/IP abuse limits at their trusted ingress; this
application limit alone does not stop distributed attempts across many emails.
Expired throttle rows can be periodically deleted by `resetAt`; existing rows reset
their counter automatically on the next attempt after expiry.

Password-reset email delivery remains a separate integration. Development returns
a reset token for local testing; production never returns it. Do not expose a
development server publicly or claim production email recovery is configured.

## Optional Google compatibility

Existing Google accounts can use the Auth.js Google provider when
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured. Register
`AUTH_URL/api/auth/callback/google` in the Google console. The former callback
redirects users to restart login; it cannot create a legacy cookie. A verified
Google email does not silently link a new Google identity to an existing password
account. OAuth itself requires live provider credentials to test end to end.

## Verification

With a local server running and matching test database:

```bash
npm run test:auth
npm run test:api
npm run check
npm run build
npm run typecheck
```

Tests create disposable accounts, verify CSRF, ownership, native Auth.js callbacks,
password compatibility, session revocation/expiry, throttling, and journal CRUD,
then remove their test data. `TEST_APP_URL` overrides the default localhost URL.
