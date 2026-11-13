# Music recommendation domain

`src/features/music/schemas.ts` defines strict Zod contracts and inferred types.
`recommendMusicCriteria(input)` in `recommendation-service.ts` validates unknown
input and returns deterministic, validated `MusicCriteria`. This pure domain
service has no fetch calls, secrets, SDKs, provider IDs, or AI dependencies.

## MusicContext

- `mood`: user-reported integer from 1 (low) to 10 (high).
- `energy`: user-reported integer from 1 (low) to 10 (high).
- `primaryEmotion`: a supported descriptive emotion label, or explicit null if
  unknown. The field is required; an AI analysis is not required.
- `intent`: match, uplift, calm, or focus.
- `timeOfDay`: morning, afternoon, evening, or night (required).

Unknown keys, unsupported labels/intents, fractional scores, numeric strings,
missing fields and out-of-range/nonfinite values are rejected. Journal text and
user identifiers are not part of the context. Callers must not silently replace
unknown self-reported values with AI estimates or fabricated defaults.

## Provider-neutral criteria

The service returns ordered min/target/max ranges for musical positivity and
intensity (0–1) and tempo in BPM, a vocal preference, deduplicated descriptors,
the chosen intent, and an explanation. These are domain preferences, not claims
about a provider's catalog metadata or therapeutic outcomes.

| Intent | Mapping                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------- |
| match  | Normalize mood/energy to positivity/intensity; tempo follows energy. Emotion supplies a soft descriptor. |
| uplift | Brighter positivity and a gradual intensity increase; low-energy contexts retain a gentle descriptor.    |
| calm   | Low intensity, slower tempo, soft/spacious textures, prefer instrumental.                                |
| focus  | Moderate intensity, steady tempo, minimal textures, prefer instrumental.                                 |

Explicit intent takes priority over emotion. For example, an angry emotion does
not introduce expressive/high-intensity music into a focus request. The mappings
are product heuristics, not medically validated effects or guarantees.

A future provider adapter can translate these criteria into supported searches,
filters or rankings without receiving raw journal content. Unsupported criteria
must remain preferences rather than being represented as guaranteed provider
capabilities. The domain itself has no network calls or credentials. The catalog adapter and
Music page described below now consume its criteria.

Run `npm run test:music` for all combinations of valid integer scores, supported
emotions (including null), and intents, plus deterministic behavior, bounds,
priority rules, gentle uplift, and invalid input rejection.

## Optional post-save intent

The journal detail page shows an optional music-intent control after successful
creation. All four native radio options start unselected. Users can skip it without
affecting their saved entry. Selected intent and any missing-energy input start in component state. Choosing
“See recommended tracks” carries them into the user-scoped in-memory query cache
for the Music page and dashboard card. They are not persisted to the journal,
account, local storage, or a URL. Reloading clears the choice.

Selecting an intent uses the recorded mood and energy with the recommendation
domain. If energy is missing, the UI asks for a listening-session value rather than
inventing one. The explicit “See recommended tracks” link opens /music using the selected intent.
Selecting a post-save option alone makes no external request.

## Time-aware rule engine

The normalized energy target is `criteria.intensity.target`; normalized positivity
is `criteria.positivity.target`. Both are 0–1. `tempoBpm` includes min/target/max
in BPM (not normalized); `descriptors` contains provider-neutral style keywords.
All output ranges are validated, ordered and bounded. The output echoes intent
and timeOfDay for traceability.

`getMusicTimeOfDay(localHour)` takes an explicit integer hour:
morning 05–11, afternoon 12–16, evening 17–21, night 22–04. The core service never
reads the system clock. The post-save UI captures the listener's browser-local
hour when they select an intent, avoiding a server-time assumption.

Rules after the base intent mapping:

- Uplift adds 0.20/0.15/0.10/0.05 to normalized input energy for
  morning/afternoon/evening/night, respectively, clamped to 0.30–1.
  Morning uplift adds 5 BPM; nighttime uplift subtracts 10 BPM.
- Evening subtracts 4 BPM and adds a warm descriptor.
- Night subtracts 5 BPM for other intents and adds soft styling.
  Calm/focus intensity is reduced by 0.05 with a zero floor.
- Match preserves the normalized energy target even at night; only pacing and
  styling shift. Calm and focus retain instrumental preference.
- Anxious, overwhelmed, tired, or lonely emotions add gentle styling for uplift;
  they never override the selected intent.

These are transparent product rules, not AI inference or claims of effectiveness.
For mood=3, energy=8, emotion=anxious, intent=calm, timeOfDay=night, the energy
target is 0.20 and tempo is 55–75 BPM (target 65). Angry/focus in the afternoon
uses target energy 0.50 with minimal, low-distraction styling.

Unit tests cover all score/emotion/intent combinations in the baseline daypart,
representative low/mid/high score combinations in every daypart, exact hour
boundaries, invalid times, and the representative policies above.

## Music page and dashboard card

`/music` requires authentication. Desktop/mobile navigation points to the route,
and the dashboard has a compact version of the same recommendation panel. Both
show the latest recorded mood/energy, current intent, explanations, real catalog
track names/artists, and external links. A choice is optional and lasts only in
the current app's memory. No account-level preference is saved.

`GET /api/music` reads only the authenticated user's latest active, non-future
journal scores and emotion label. No text is selected. `POST /api/music` accepts
a strict intent/timeOfDay input and optional listening energy. It reloads owned
source data; supplied energy is used only if energy was not recorded. Extra
fields such as userId or journal content are rejected.

The server-only MusicProvider interface takes domain criteria. The initial adapter
uses the [iTunes Search API](https://performance-partners.apple.com/search-api),
with generic genre/style queries, a bounded result count and an eight-second
timeout. No credentials, raw entries, emotion labels, or numeric mood/energy scores
are sent to the catalog. US catalog results may differ from local availability.
The adapter validates result metadata, deduplicates IDs, and permits only HTTPS
links on music.apple.com or itunes.apple.com. No audio or artwork is embedded.

These are search-based suggestions. Each track explains the search direction and
explicitly states that tempo/energy were not measured. The app does not claim
exact audio-feature matches or therapeutic benefits. Missing history, missing
energy, no selection, loading, empty catalog results, and provider errors have
separate UI states with retry where appropriate. Failed requests never fabricate
tracks or change journal data.

Run `npm run test:music-provider` for disposable database and mocked catalog tests.
Set `TEST_LIVE_MUSIC=1` for an optional live request using only “ambient piano”.
Provider results are cached in memory for five minutes by user, source and selected
context; no network retries happen automatically on provider errors.

## Saved music preferences

Settings includes Favorite genres (up to five), Disliked genres (up to five),
Preferred languages (up to three), and Allow explicit tracks (off by default).
Selections use a shared strict Zod schema. Duplicate entries, unsupported values,
extra fields and favorite/disliked overlaps are rejected. An empty list means no
preference for that category. Saving is explicit; failed saves preserve the draft.

The additive music_preferences migration stores these values on UserSettings,
with empty-array defaults and allowExplicit=false for existing users.
Authenticated GET /api/music/preferences returns the current user's preferences;
PATCH /api/settings accepts a complete musicPreferences object. User IDs are taken
from the session, never the request. Unrelated settings updates preserve them.

The recommendation service reloads saved preferences and passes them to the pure
engine as its second argument. Its provider-neutral criteria include constraints.
Clients cannot override saved restrictions in POST /api/music. Preference changes
cancel/remove cached recommendations and refresh the music source; the source
query also refreshes when revisiting Music.

The iTunes adapter applies these rules:

- Favorite genres guide search terms and rank matching catalog genres first.
  They are preferences, not an exclusive allowlist.
- Disliked genres are excluded using broad documented genre-family mappings.
  When exclusions exist, missing or unrecognized genre labels are omitted rather
  than assumed safe. This depends on catalog metadata, not audio analysis.
- Every preferred language contributes a bounded search (up to three). Language
  terms bias retrieval; they do not verify the language sung. The provider's lang
  parameter controls response localization, so it is not used as a track-language
  filter. This limitation is disclosed in Settings and recommendation notes.
- Explicit=false requests explicit=No and filters responses again, accepting only
  cleaned/notExplicit tracks. Explicit and unknown labels are omitted. Allowing
  explicit content changes the request and permits labeled explicit tracks.
- Empty results after filtering stay empty; restrictions are never silently relaxed.

No new provider credentials or AI calls are involved. Run npm run test:music,
npm run test:music-provider and npm run test:music-preferences for domain,
filter/ranking, persistence, validation and user-isolation checks.
