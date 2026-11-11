# Dashboard aggregation

`GET /api/dashboard?timeZone=Asia%2FKolkata` requires an authenticated session and
returns one `DashboardResponse` (see `src/features/dashboard/types.ts`). The optional
IANA time zone defaults to UTC; the browser sends its local zone. Responses are
private and not cached. Invalid zones return 400, unauthenticated requests return
401, and unexpected failures return a generic 500.

The response includes today's journal status/count/latest entry ID, weekly average
mood, average energy, total journal count, weekly count, a seven-day mood trend,
five recent entries, and explicit `coming_soon` placeholders for personal insights
and music recommendations. User and settings are included to initialize the shell
without a second dashboard request.

The week means today plus the six preceding calendar days in the requested zone.
Both averages are entry-weighted over that period, rounded to two decimals. Unknown
energy values are excluded from its average. Empty averages and missing daily mood
values are null, not zero. Daily counts are zero for empty days. Journal count is
all-time. Archived and future-dated entries are excluded from all dashboard data.

`src/server/dashboard/service.ts` validates the query, derives date boundaries,
fills missing days, and shapes the response. `repository.ts` performs aggregate SQL,
fetches at most five recent entries, and loads settings in one repeatable-read
transaction. SQL parameters are bound, all queries filter by the authenticated
owner, and UTC database timestamps are converted explicitly for local day boundaries.
No full-history list is loaded for dashboard aggregation.

The dashboard uses one aggregate request; existing analytics/settings screens load
their legacy data only when opened. The separate `/journal` page remains paginated.
Run `npm run test:dashboard` with the local app/database to check empty results,
averages, time zones, exclusions, recent limits, authentication, and isolation.

The responsive dashboard presents a daily check-in card, weekly summary cards,
a Recharts seven-day line chart, recent reflections, and labeled future-feature
placeholders. Missing days remain gaps, and a keyboard-accessible table provides
exact values alongside the chart. Empty journals show a prompt instead of invented
trend data. Chart animations are disabled for predictable, motion-free rendering.
