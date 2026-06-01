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


TODO:
Key Features Can Build
1. Mood Tracking & Journaling

Quick mood picker: Emoji sliders, colors, or scales (1-10) for energy/valance.
Daily/ multiple entries: Text, voice notes, photo uploads (e.g., "what made me feel this way").
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
AI-enhanced: User describes "I feel overwhelmed but hopeful" → LLM maps to audio features (valence, energy, tempo, danceability) + generates playlist.
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
