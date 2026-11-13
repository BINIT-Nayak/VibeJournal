# Analytics Redis cache

Set server-only `REDIS_URL` to enable caching (for local development,
`redis://127.0.0.1:6379`). Leave it unset to compute directly from PostgreSQL.
Use a dedicated Redis database per deployment, authentication, and `rediss://`
for hosted TLS connections. Redis contains private aggregate mood/sleep/tag data;
it must not be publicly accessible. No journal text or credentials are cached.

`src/server/analytics/cache.ts` wraps the analytics service's expensive database
aggregation and calculations. React components and Prisma repositories contain
no cache logic. Keys include a schema version, hashed authenticated user ID,
UTC start/end dates, and a random per-user generation. Responses retain their
original `period.asOf` calculation timestamp. The result TTL is five minutes;
UTC date rollover automatically selects a different key.

After a successful journal create, update (including tags, archive and restore),
delete, bulk delete, or account deletion, the server rotates the user's generation.
This invalidates every range for that user without a Redis KEYS/SCAN operation.
Old results expire within five minutes; generation markers expire after 24 hours.
A missing/evicted marker receives a new random generation, so old results cannot
become reachable again. Lua compare-and-set prevents a calculation already in
flight during invalidation from repopulating the active generation. An in-flight
HTTP request may still return its pre-write snapshot.

Cache connection/command failures fall back to uncached calculation. Writes never
fail merely because Redis is unavailable. Connections/commands are bounded to one
second each; failed connections have a ten-second retry cooldown. Logs contain
only generic, throttled availability messages. If invalidation cannot reach Redis,
an existing result can remain stale until its five-minute TTL expires; strict
transactional DB/cache consistency is not promised. No AI reflections or dashboard
results are cached by this module.

Run `npm run test:analytics-cache` with `redis-server` installed (or provide
`REDIS_SERVER_BIN`). The test starts an isolated ephemeral Redis process with
persistence disabled and verifies hits, user/range isolation, invalidation races,
expiry, corrupt-cache recovery and outage fallback.

Client connection handling follows the [node-redis production guidance](https://redis.io/docs/latest/develop/clients/nodejs/produsage/),
including an error listener and disabled offline command queuing.
