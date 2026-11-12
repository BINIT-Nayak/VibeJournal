# Weekly reflection

The Analytics page offers **Review weekly summary**, followed by an explicit
**Generate weekly reflection** action. This is on-demand, not a scheduled job.
The window is today plus the previous six UTC dates, independent of the selected
analytics chart range. A generated reflection is displayed for the current visit;
it is not persisted and does not change any journal values.

## Data minimization

GET /api/weekly-reflection prepares an authenticated, owner-scoped summary without
calling AI. POST to the same route accepts only an empty JSON object and regenerates
the summary on the server. The client cannot submit source text or choose a user.
Both responses are private/no-store.

The strict provider input contains only:

- UTC start/end dates, journal count and distinct recorded days.
- Entry-weighted average mood and energy.
- Seven daily mood and sleep means, entry counts, with nulls for unknown values.
- Average sleep, recorded and missing sleep sample counts.
- Exercise/non-exercise day counts; unknown and conflicting days are separate.
- Up to five recurring AI-derived theme labels and entry/day counts, requiring
  at least two distinct days. Archived, future, out-of-range, foreign-owned, and
  stale-version analysis rows do not contribute.

Aggregation queries do not select journal text, titles, transcripts, or previous
reflection prompts. No raw-text fallback exists. Theme labels are still personal
data and are disclosed in the preview; they are sent as untrusted data, not prompt
instructions. These labels are interpretations rather than user-entered facts.

## Consent and validation

Existing per-user AI consent must be enabled. It is checked before aggregation,
immediately before the provider call, and again before returning the result.
Missing consent rejects with 403. Fewer than three recorded days rejects with 422
without calling the provider. Three days is a context minimum, not evidence of a
meaningful trend. A request already transmitted cannot be recalled.

A server-only, vendor-neutral WeeklyReflectionProvider accepts the strict summary.
The Anthropic adapter reuses server AI configuration and implements timeout,
abort handling, no caching, and no redirects. It rejects extra input fields,
truncated output, malformed JSON and invalid structured responses. The service
revalidates output, including from injected adapters. Secrets and trusted prompts
remain server-only.

Output is a bounded reflection, up to three observations, and one reflection
prompt. The UI labels it AI-generated and cautions against diagnosis or causation.
The prompt prohibits inventing journal details, filling missing values, or treating
one week as a reliable long-term pattern. Provider failures return a generic error;
the original journal and summary remain usable. There are no automatic retries.

## Verification

Run npm run test:weekly-reflection with the local database. Tests create disposable
users and use mocked AI transport to verify aggregate values, missing days,
exercise ambiguity, recurring themes, date/owner exclusions, consent checks,
strict compact-only requests and output validation. No live AI requests are made.
