# Local PostgreSQL and Redis with Docker

Next.js runs on your host with `npm run dev`; Compose runs only PostgreSQL and Redis. Docker Desktop (or Docker Engine plus Compose v2+) must be running.

| Service       | From your local Next.js process | From a future app on the Compose network |
| ------------- | ------------------------------- | ---------------------------------------- |
| PostgreSQL 17 | `127.0.0.1:55432`               | `postgres:5432`                          |
| Redis 7.4     | `127.0.0.1:56379`               | `redis:6379`                             |

The nonstandard host ports let existing local PostgreSQL/Redis installations keep using 5432/6379. Published ports bind only to loopback. These are development services, with a documented local-only database password and no Redis authentication.

## First setup

For a new checkout, copy `.env.example` to `.env`. Do not overwrite an existing environment file or existing encryption key.

```sh
cp .env.example .env
openssl rand -base64 48
openssl rand -base64 32
```

Paste the first generated value into `AUTH_SECRET` and the second into `JOURNAL_DEVELOPMENT_WRAPPING_KEY` in `.env`. Keep both private and preserve the wrapping key across restarts. The example selects development encryption; production rejects this provider and requires AWS KMS.

```sh
npm install
npm run infra:up
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Open http://localhost:3000. `infra:up` waits for both health checks. `prisma:deploy` applies the committed migrations to the new database; `prisma:migrate` is for authoring new migrations, not routine setup.

The matching local application values are:

```dotenv
DATABASE_URL=postgresql://vibejournal:vibejournal_local_only@127.0.0.1:55432/vibejournal?schema=public
REDIS_URL=redis://127.0.0.1:56379
AUTH_URL=http://localhost:3000
```

Next.js reads `.env.local` ahead of `.env`, while the Prisma CLI reads `.env`. For an existing checkout, remove conflicting duplicate URL definitions or update them consistently. Alternatively, export the URLs in the terminal used for both migrations and `npm run dev`; explicit process environment takes precedence. Restart Next.js after changing environment values. Never prefix these server-only settings with `NEXT_PUBLIC_`.

The Compose database starts empty. This does not import or modify your existing host database. Existing ignored environment files are not edited by this setup. Move data only through an intentional backup/restore workflow, preserving the journal encryption environment and wrapping keys.

## Daily commands and storage

```sh
npm run infra:status
npm run infra:logs
npm run infra:down
npm run infra:up
```

`infra:down` removes containers and the Compose network, but retains the named `vibejournal_postgres_data` volume. PostgreSQL data survives container replacement and restarts. Redis intentionally has no persistent volume, snapshots, or AOF: it holds only expiring analytics and denial caches. It is bounded to 128 MB with `allkeys-lru` eviction. PostgreSQL remains the durable rate-limit authority; an unavailable or empty Redis falls back to PostgreSQL/uncached analytics.

Inspect services directly:

```sh
docker compose exec postgres psql -U vibejournal -d vibejournal
docker compose exec redis redis-cli ping
```

A destructive reset is **`docker compose down --volumes`**. It permanently removes this Compose project's database volume; use it only when you intend to discard local accounts and journals. Ordinary stop/start does not require it. Encryption keys are outside the volume, so backing up only PostgreSQL is insufficient for encrypted journals.

## Customize ports or development credentials

The default npm commands need no extra Compose environment file. To override Compose settings separately from application secrets:

```sh
cp .env.docker.example .env.docker
# Edit .env.docker, then use this option for all Compose commands:
docker compose --env-file .env.docker up -d --wait
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker down
```

Update `DATABASE_URL`/`REDIS_URL` in the application's environment to match. URL-encode special characters in database passwords. `.env.docker` is ignored by Git. Docker Compose does not automatically load `.env.local` or `.env.docker`; without `--env-file`, it reads `.env` and the shell. Shell variables override file values.

PostgreSQL's initialization user/password/database settings apply only to an empty data directory. Editing them does not update credentials in an existing volume. Change credentials through SQL or deliberately initialize a separate empty volume; do not reset a database merely to resolve a connection error.

## Later containerized deployment

The application already reads database and Redis endpoints from runtime environment variables. For an app container attached to this Compose network, set:

```dotenv
DATABASE_URL=postgresql://vibejournal:ENCODED_PASSWORD@postgres:5432/vibejournal?schema=public
REDIS_URL=redis://redis:6379
AUTH_URL=https://your-public-app.example
```

Inside a container, `localhost` refers to that container. Use service DNS names and internal ports, not host-published ports. Keep `AUTH_URL` as the public browser-facing origin, not the internal service address. Configure `AUTH_SECRET`, `JOURNAL_KEY_PROVIDER=aws-kms`, a stable deployment-specific `JOURNAL_ENCRYPTION_ENV`, AWS region/KMS key, and service-role permissions at runtime. Do not bake `.env` files, keys, or credentials into images; `.dockerignore` excludes them and local build artifacts.

A future app service can wait for `postgres` with `depends_on: condition: service_healthy`; Redis should remain optional for application correctness. Run `prisma migrate deploy` as a release job before serving traffic. Use deployment secrets, authenticated/TLS database and Redis connections where appropriate, private networking, and database backups instead of exposing these local development defaults. No Next.js container or Dockerfile is needed for the current host-based workflow.

The image tags pin the PostgreSQL major and Redis minor lines rather than `latest`. Patch updates can be pulled with `docker compose pull`; PostgreSQL major upgrades require a planned data upgrade/restore, not just changing the image tag. Deployment images can be pinned to reviewed digests for reproducibility.

Reference: [Compose service discovery and ports](https://docs.docker.com/compose/how-tos/networking/), [PostgreSQL official image initialization and storage](https://hub.docker.com/_/postgres), [Redis official image](https://hub.docker.com/_/redis).
