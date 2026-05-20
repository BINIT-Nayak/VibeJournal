# VibeJournal

VibeJournal is a private mood journal MVP for quick mood check-ins, deeper reflection, gentle CBT-inspired insights, and music suggestions for the user's current emotional state.

## Stack

- Next.js + TypeScript
- CSS Modules and global CSS variables
- PostgreSQL with Prisma
- Native Canvas charts
- Spotify and OpenAI integration points planned behind app services

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

Create a free Postgres database, for example with Neon, then copy `.env.example` to `.env` and set `DATABASE_URL`.

```bash
npm run prisma:generate
npm run prisma:migrate
```

The current UI stores entries in browser state so the MVP works before database/auth wiring is finished.
