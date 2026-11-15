# VibeJournal

VibeJournal is a private mood journal MVP for quick mood check-ins, deeper reflection, gentle CBT-inspired insights, and music suggestions for the user's current emotional state.

## Stack

See [the foundation architecture](docs/architecture.md) for folder boundaries,
new dependency setup, and [authentication setup](docs/authentication.md).

- Next.js + TypeScript
- Tailwind CSS, CSS Modules, and global CSS variables
- PostgreSQL with Prisma
- Auth.js credentials with encrypted cookies, revocable server sessions, and scrypt password hashing
- Native Canvas charts
- Zod, React Hook Form, TanStack Query, and Recharts foundations
- Server-protected pages/APIs, Zod input validation, and persistent auth throttling
- Spotify and OpenAI integration points planned behind app services

## Run Locally

Run PostgreSQL and Redis with Docker Compose, and Next.js directly on your machine.
See [local infrastructure setup](docs/local-infrastructure.md) for environment secrets,
existing-database setup, port overrides, persistence, and future container deployment.

For a new checkout, copy `.env.example` to `.env` and generate `AUTH_SECRET` and
`JOURNAL_DEVELOPMENT_WRAPPING_KEY` as described in that guide. Then:

```bash
npm install
npm run infra:up
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Open `http://localhost:3000`. PostgreSQL is exposed on `127.0.0.1:55432` and Redis on
`127.0.0.1:56379`, avoiding conflicts with existing host services. `npm run infra:down`
stops the infrastructure while preserving PostgreSQL data.

## Database

See [the journal schema and migration notes](docs/database.md) for models,
constraints, indexes, compatibility, and database tests. A hosted PostgreSQL database
also works: set `DATABASE_URL` accordingly instead of using the Compose database.
`npm run prisma:migrate` creates new migrations; `npm run prisma:deploy` applies
committed migrations. Auth and journal persistence require PostgreSQL; Redis is optional.

## Implemented Product Features

- Signup, login, logout, session cookies, account settings, password change, and password reset token flow.
- Protected API routes so each user can only access their own journal data.
- Prisma persistence for users, sessions, reset tokens, settings, and mood entries.
- Mood tracking with mood picker, energy/stress sliders, notes, prompts, preset tags, and custom tags.
- Context tracking for sleep, movement, and social energy.
- Voice-note transcript and photo attachment metadata for richer entries.
- Journal history, create/edit/delete/archive/view, search, filters, mood calendar, word cloud, correlation heatmap, and trend chart.
- CBT-inspired local insights, context summaries, and safety-net language for severe distress signals.
- Music intent mapping with valence, energy, tempo, and danceability hints plus open-in-Spotify search.
- Profile actions for JSON data export, account delete-all entries, theme preference, and reminder settings.

## Deployment

This version uses dynamic API routes and Prisma, so deploy it as a Next.js web service, not as a static site. On Render, use a Web Service with:

- Build command: `npm install && npm run prisma:generate && npm run build`
- Start command: `npm run start`
- Environment variables: `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL` (the public HTTPS origin), plus production AWS KMS encryption configuration; see [deployment configuration](docs/local-infrastructure.md#later-containerized-deployment).
- Apply committed migrations with `npm run prisma:deploy` as a release step.

TODO:
Key Features Can Build Next

1. Mood Tracking & Journaling

Quick mood picker: Emoji sliders, colors, or scales (1-10) for energy/valance.
Daily/ multiple entries: Persist uploaded voice/audio and image files in a real storage service.
Tags: "work stress", "gratitude", "anxious", custom tags.
Rich text editor with prompts: "What’s one thing you’re proud of today?"

2. AI Therapy Insights

Daily/Weekly Summaries: "You've had 3 low-energy days this week — common triggers seem to be work meetings."
Pattern Recognition: Correlate mood with sleep, weather, location, habits (if you add trackers).
Guided Reflections: AI suggests CBT-style questions or reframes negative thoughts.
Progress Reports: Mood trends, improvement streaks, exportable PDFs for therapists.
Safety net: Redirect to hotlines or "talk to a human" if it detects severe distress.

3. Music & Playlist Generator

One-tap "Play for my mood" button.
Integrate Spotify API (most popular) or YouTube Music / Apple Music.
AI-enhanced: User describes "I feel overwhelmed but hopeful" → LLM maps to audio features (valence, energy, tempo, danceability) + creates a real playlist.
Personalized based on user's listening history (with permission).
Save playlists, "Mood Radio" stations, or auto-generate daily mixes.
In-app player or seamless open-in-Spotify.

4. Advanced / Differentiating Features

Habit & Context Tracking — Sleep, exercise, social interactions, menstrual cycle (optional).
Community (Opt-in) — Anonymous mood circles or shared (anonymized) insights.
Visualizations — Beautiful charts, mood calendar, word clouds from entries.
Reminders & Streaks — Gentle notifications, streak rewards.
Multi-language & Accessibility — Voice input/output.
Offline-first — PWA that syncs when online.
Export & Privacy — Full data export, end-to-end encryption option.
