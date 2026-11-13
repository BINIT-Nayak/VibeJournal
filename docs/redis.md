# Optional Redis infrastructure

Redis has exactly two initial uses: caching expensive analytics and absorbing
repeated rate-limit denials. Sessions, journal records, preferences and AI results
remain in PostgreSQL. There are no Redis queues, locks for journal writes, or
Redis-only security counters.

Set server-only `REDIS_URL` to enable both uses, for example
`redis://127.0.0.1:6379` locally. Run `redis-server --bind 127.0.0.1` for a local
instance. Use authenticated `rediss://` connections and a separate Redis database
per deployment in hosted environments. Leaving the URL unset is supported; no
Redis connection is attempted. Never use a NEXT_PUBLIC variable for credentials.

`src/server/redis/client.ts` owns the lazy shared connection, bounded connection
and command waits (one second each), disabled offline queue, ten-second retry
cooldown and generic throttled logging. Consumers receive null on unavailable
Redis and execute their own PostgreSQL fallback. Cache values, user identifiers,
connection URLs and credentials are never logged.

## Rate limiting

PostgreSQL remains the atomic, durable quota ledger. Every potentially allowed
attempt goes through that ledger. Once it rejects an attempt, Redis caches the
exhausted bucket until just before the database window expires. Further requests
can receive 429 without hitting PostgreSQL. Keys contain HMAC identities and the
policy limit/window, preventing cross-user, cross-scope or old-policy collisions.
Denied requests never extend the window. Retry-After is read from Redis TTL when
available, otherwise from PostgreSQL.

This deliberately saves database work under repeated abuse rather than maintaining
two independent counters. Redis loss, eviction, restart or recovery cannot grant a
fresh quota: a miss goes back to the same PostgreSQL counter. If both PostgreSQL
and Redis are unavailable, protected operations do not bypass their rate limit.
Manual administrative quota resets must also remove the corresponding Redis block
or wait for the old window to expire.

## Analytics

See [analytics caching](analytics-cache.md): five-minute result TTLs, per-user and
UTC date-range keys, versioned invalidation after journal mutations and protection
against stale concurrent fills. Redis outages compute analytics directly from
PostgreSQL and never fail journal writes. A missed invalidation during an outage
can leave a cached snapshot stale for at most its remaining five-minute TTL.

## Validation

`npm run test:analytics-cache` starts an isolated Redis instance and checks both
analytics caching and Redis-backed rate-limit denials, TTLs, missing configuration,
and outage fallback. Its service-boundary tests use deterministic database doubles.
`npm run test:rate-limits` separately exercises the real PostgreSQL ledger and HTTP
429 responses against the local application. No new database migration is needed.
