# VibeJournal data export, version 1

In Settings → Privacy, choose **Download my data (JSON)**. The authenticated
GET /api/account/export endpoint returns a UTF-8 JSON attachment named
vibejournal-data-YYYY-MM-DD.json. It accepts no query parameters, owner IDs or
filters. Every database query is scoped to the session's user. Responses,
including errors, are private and not cacheable.

The download contains readable private text decrypted on the server. Store it
privately. It is a data portability file, not an encrypted backup or an import
format. No import feature is implied.

## Contract

Top-level fields:

| Field            | Meaning                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| format           | Constant vibejournal-data-export                                                                                                  |
| schemaVersion    | Integer 1; incompatible format changes increment this                                                                             |
| exportedAt       | UTC ISO 8601 timestamp when export assembly completed                                                                             |
| account          | id, email, nullable name, authProvider, createdAt, updatedAt                                                                      |
| settings         | AI consent, dark mode, privacy acknowledgment, reminder settings, Spotify connection flag and settings timestamps; null if absent |
| musicPreferences | favoriteGenres, dislikedGenres, preferredLanguages, allowExplicit; null if settings are absent                                    |
| journals         | All server-saved journals, including archived entries, ordered by createdAt then id ascending                                     |
| tags             | All saved tag IDs and decrypted names, including currently unused tags                                                            |
| aiAnalyses       | All stored AI analyses, including stale ones, ordered by createdAt then id ascending                                              |
| musicHistory     | Saved playlist runs, ordered by createdAt then id ascending; empty when none are stored                                           |

Each journal contains id, nullable title, content, nullable voiceNote, photoNames,
nullable prompt, tracking, tags, nullable archivedAt, createdAt and updatedAt.
photoNames are names, not attached image bytes. voiceNote is the stored text,
not an audio file. Tags contain id, name and zero-based position.

Tracking contains moodScore (1–10), nullable energyScore (1–10), nullable
sleepHours (hours), nullable exercised (boolean), nullable socialScore (1–10),
and preserved nullable legacy fields mood (category), stress and exerciseMinutes.
Unknown values stay null; false and zero are not converted to missing values.
The export does not invent inferred or missing tracking values.

Each AI analysis contains id, journalEntryId, createdAt, sourceUpdatedAt, stale,
primaryEmotion, emotions, sentimentScore, themes, estimatedEnergy,
reflectionPrompt and confidence. stale indicates that the source version differs
from the journal's exported updatedAt. Interpretation is distinct from
user-entered tracking and is not a diagnosis. The database does not currently
store model name, provider name or token usage per analysis, so these are not
invented. Disabling AI does not remove previously stored analyses from export.

Each music history item contains id, mood, intent (stored JSON), provider,
nullable externalUrl, nullable tracks (stored JSON), and createdAt. Recommendations
that were never persisted are not included.

All dates serialize as UTC ISO 8601 strings. Empty collections are [].
The account/settings/journal/analysis/tag/history rows are read in a consistent
PostgreSQL snapshot. Decryption occurs after the snapshot transaction completes.
No successful attachment is returned if any required encrypted content cannot
be decrypted or validated: the user receives an error and can retry.

## Exclusions and boundaries

- Password hashes, session/access/reset tokens, Google subject identifiers,
  encryption keys and wrapped keys, ciphertext storage fields, internal tag
  indexes, rate-limit records and internal sync receipts are excluded.
- Local IndexedDB drafts and unsynced mutations are not server data and are
  excluded. Sync them first to include them.
- Deleted journals, transient weekly reflections, derived analytics cache
  entries, and records belonging to any other account are excluded. Raw
  tracking and stored AI results are included so users can analyze their data.
- No historical truncation or default history-page limit is applied. Version 1
  assembles the complete JSON in memory; very large accounts may require a
  future background export job. Failures return an error, never a partial file.

Errors use { "error": { "code": "...", "message": "..." } }: 401 UNAUTHORIZED,
400 INVALID_QUERY, or 500/503 EXPORT_UNAVAILABLE. Encryption/provider diagnostics
and journal text are never included in error responses or logged by the exporter.

Run npm run test:data-export against the local development server and PostgreSQL.
The suite uses two disposable accounts to verify isolation and cleans them up.
