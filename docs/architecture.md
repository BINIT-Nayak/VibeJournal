# VibeJournal foundation

VibeJournal uses Next.js App Router, React, and strict TypeScript. This foundation
extends the existing application without replacing its working journal or login.

## Boundaries

- `src/app/`: routing, metadata, and composition only. API route files export handlers
  from `src/server`; pages compose feature entry points.
- `src/features/auth/`: existing authentication UI, client contracts, Zod schema,
  and React Hook Form starter hook.
- `src/features/journal/`: journal UI, mood logic, types, and feature-specific components.
  Existing insight/music screens remain here to preserve behavior; no extra feature
  modules are introduced by this refactor.
- `src/server/`: Prisma singleton, auth/session logic, serialization, and API handlers.
  Every module uses `server-only` to prevent imports into client bundles.
- `src/components/ui/`: existing reusable Slider, SectionTitle, and StatCard primitives.
- `src/components/providers.tsx`: application-wide client providers.
- `src/lib/`: generic HTTP and value-parsing helpers only.
- `src/styles/`: global styles.
- `prisma/`: PostgreSQL schema and migrations; stays at the repository root.

The `@/*` alias resolves to `src/*`. Only `auth` and `journal` feature modules exist.
Because this is an existing app, their working code is retained instead of replacing
it with empty placeholders. No repositories, service containers, or speculative
feature modules are added.

Keep Prisma, secrets, and authentication internals out of client components.
Validate untrusted inputs on the server even when a form validates them on the client.

## UI and data foundations

Tailwind CSS uses its PostCSS plugin and theme/utilities imports. Preflight is
intentionally omitted to preserve the existing CSS Modules design. New components
can use utility classes; existing styles do not need to be rewritten.

The root layout mounts a TanStack Query provider with a separate QueryClient per
mounted app, a 60-second stale time, one query retry, and no mutation retries.
Existing fetch calls are retained. Clear private query data on logout/account changes
when migrating those calls to queries.

React Hook Form is installed with the Zod resolver. `useCredentialsForm` is a
starter hook, not a replacement for the current auth form. Recharts is installed
for future client-side charts; existing Canvas charts are retained.

## Authentication transition

The existing cookie/session authentication remains authoritative. Auth.js (`src/server/auth/config.ts`) is
scaffolded with **no enabled providers**. Its endpoints do not sign users into the
existing app, and its session is not used by existing protected API routes.

Auth.js v5 currently uses a beta release in its official App Router installation
guide. The installed version is pinned. Before enabling it, migrate the login UI,
route guards, logout, password-reset session revocation, and Google account linking
together. Do not enable a second independent login flow in production.

Set `AUTH_SECRET` to a unique random secret and `AUTH_URL` to the deployed origin
when activating Auth.js. The current custom auth does not require those values.
Google's existing custom OAuth uses `APP_URL`, `GOOGLE_CLIENT_ID`, and
`GOOGLE_CLIENT_SECRET` instead.

## Local setup and verification

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and set a PostgreSQL `DATABASE_URL`.
3. Run `npm run prisma:generate` and `npm run prisma:deploy`.
4. Run `npm run dev`.
5. Run `npm run check`, `npm run typecheck`, and `npm run build` before release.

Development artifacts use `.next-dev`; production builds use `.next` so a build
cannot overwrite a running development server's bundles.

Deploy as a Node.js web service. Apply committed migrations as a release step
before starting the new app version. Never use `prisma migrate dev` or a database
reset against production.

This is a foundation milestone, not a production-readiness certification. Existing
release gaps (including password-reset email delivery) still need work. No Redis,
AI-provider integration, music-provider integration, or offline sync is added here.

## Reference documentation

- [Auth.js App Router setup](https://authjs.dev/getting-started/installation)
- [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [TanStack Query App Router guidance](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
