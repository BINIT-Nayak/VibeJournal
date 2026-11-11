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
- `service.ts`: validates the range and composes the computations.

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

## Chart-ready mood history

Use `/api/analytics?days=7`, `?days=30`, or `?days=90` (30 by default).
`statistics.moodTrend` contains exactly that many `MoodTrendPoint` objects in
ascending UTC calendar-date order, including today. `period` identifies the exact
range and observation time. The API retains support for other integer ranges
between 1 and 90; the UI presets are 7, 30, and 90.

```json
[
  { "date": "2026-11-09", "averageMood": 6.5, "averageEnergy": null, "journalCount": 2 },
  { "date": "2026-11-10", "averageMood": null, "averageEnergy": null, "journalCount": 0 }
]
```

Charts can use `date` as the x-axis and `averageMood` as the numeric y-axis (1–10).
Do not replace nulls with zero, carry values forward, or interpolate gaps. For a
Recharts line chart, keep `connectNulls={false}`. Days with multiple entries use the
mean of their recorded mood scores, rounded to two decimals. The period mean is
entry-weighted, not the mean of daily means. Unknown energy is excluded from its
own daily denominator. Empty ranges still return every day, with null averages.

`mood-trend.ts` builds these points on the server. `npm run test:mood-trend` exercises
empty and sparse datasets for all three presets, including gap preservation,
multiple entries per day, ordering, exact boundaries, exclusions, and isolation.

## Mood versus sleep

The response includes `sleepComparison`, calculated server-side by
`sleep-comparison.ts` from existing daily aggregates (no extra database query).
It compares at least 7 hours with less than 7 hours, returning each group's
`sampleSize` in **UTC days** and `averageMood` (null for an empty group).
Each day contributes its daily mean mood once. Multiple recorded sleep values on
a day are averaged before grouping, using the unrounded value. All moods on that
day contribute to its daily mood mean. Zero hours is recorded sleep; days without
any recorded sleep are excluded and counted in `excludedDaysWithoutSleep`.
Days without journal entries are not samples.

Both groups need at least five days; otherwise `status` is `insufficient_data`
and `moodDifference` is null. Available differences are the at-least-7-hours mean
minus the less-than-7-hours mean, rounded to two decimals. The five-day minimum
is a display guardrail, not a statistical significance test. Summaries explicitly
avoid causal or significance claims, even when the comparison is available.
A seven-day window cannot meet this minimum; choose 30 or 90 days for more data.

The Analytics screen displays both sample sizes, averages, and the cautious
summary. Run `npm run test:sleep-analysis` against a local app/database to check
empty, sparse, one-group, threshold, daily-weighting, date-range and ownership cases.
