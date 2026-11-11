# Server-side analytics

`GET /api/analytics?days=30` requires authentication. The range includes today and
the preceding calendar days in UTC; it defaults to 30 and accepts 1–90 days.
Responses are private/no-store. Archived and future-dated entries are excluded.

Responsibilities under `src/server/analytics`:

- `repository.ts`: owner-scoped Prisma/SQL aggregates in one repeatable-read snapshot.
  Reads no journal text; returns at most 90 daily buckets, three correlation rows,
  and the top 20 tags, ordered by frequency then name.
- `statistics.ts`: entry-weighted means, recorded/missing counts, gap-filled mood
  and energy trends, sleep range, exercise counts and grouped mood means, tag frequency.
- `correlations.ts`: Pearson coefficients from paired sufficient statistics.
  Binary exercise uses 0/1 (point-biserial correlation). Requires 10 pairs across
  5 distinct days. Missing pairs are omitted; constant values return no variation,
  not a fabricated zero. Coefficients are clamped to [-1, 1] and rounded to 3 decimals.
- `insights.ts`: deterministic readable summaries and cautious association text.
  Association text appears only for available coefficients with absolute value
  at least 0.3. It makes no causal, diagnostic, significance, or predictive claim.
- `service.ts`: validates the range and composes the three computations.

All implementation modules use `server-only`. Shared DTO types live under
`src/features/analytics`; the browser renders the endpoint response without
calculating statistics or correlations. The Analytics screen no longer requests
full journal history. No AI provider or consent is required for these descriptive
statistics; the future personal-insights dashboard section remains a placeholder.

Zero sleep hours and exercise=false are recorded values. Null metrics are unknown.
Exercise statistics count entries, not unique days; repeated daily entries contribute
individually to means and correlations. These are exploratory summaries, not independent
samples or evidence of causation. Empty periods have null averages and zero counts.

Run `npm run test:analytics` with a local app/database for aggregate, correlation,
missing-value, date-range, privacy, and ownership checks using disposable fixtures.
