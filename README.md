# VibeJournal

VibeJournal is a private mood journal MVP for quick mood check-ins, deeper reflection, gentle CBT-inspired insights, and music suggestions for the user's current emotional state.

## Stack

- Next.js + TypeScript
- CSS Modules and global CSS variables
- PostgreSQL with Prisma
- Cookie sessions with password hashing
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

Auth, account settings, and journal entries now use Prisma-backed API routes, so a real `DATABASE_URL` is required for login/signup and persistence.

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
- Environment variable: `DATABASE_URL`


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
