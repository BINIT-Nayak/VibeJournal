# VibeJournal test strategy

Test product contracts at the cheapest layer that can catch the failure. Keep most assertions in fast service/analytics and component tests, use real PostgreSQL for persistence/security boundaries, and reserve browsers for a few connected journeys. Do not duplicate every edge case across all four layers.

## Responsibilities

| Layer                                | What belongs here                                                                                                           | Current examples                                                                                                                   | What to avoid                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit (Vitest/Node)                   | Pure service decisions, statistics, thresholds, schemas, missing data                                                       | 7/30/90-day gaps, weighted mood, missing energy, sleep sample sizes/non-causal insights, normalized music intents                  | Reimplementing formulas in tests, inspecting private helpers, mocking Prisma calls to verify query syntax |
| Integration (real PostgreSQL + HTTP) | Repository results, constraints, ownership, transactions, auth/session boundaries, payload errors, cursor/version contracts | Cross-owner reads/writes/deletes, stale updates, tied timestamps, CRUD and pagination, auth revocation, empty/sparse analytics     | Mocking the database or replacing service logic; dependence on another developer's accounts               |
| UI (RTL + user-event/jsdom)          | Labels, validation feedback, keyboard interaction, pending/error/retry behavior                                             | Sign-in validation, invalid credentials/network failure, disabled submission, password visibility, numeric keyboard mood selection | Component state, hook invocation counts, class names, giant DOM snapshots, chart-library SVG internals    |
| End-to-end (Playwright)              | A small number of real connected user journeys                                                                              | Registration → create/edit journal → cancel/confirm delete; login → theme persistence → logout/protected-route redirect            | Repeating every score/tag/range combination, arbitrary sleeps, retries that conceal flaky tests           |

A callback or API response is an appropriate unit/component boundary. For example, the sign-in component tests replace `fetch` to supply a pending or failed response and assert the visible recovery behavior. They do not assert how many hooks ran or what internal state was set. Repository tests execute actual Prisma queries and assert stored/read results, not generated SQL. Their encrypted field is an opaque synthetic fixture; encryption correctness is covered separately.

The mood selector's accessible roles/names and password field visibility are public user contracts. Date/time fixtures are explicit UTC values. Assertions target unknown values (`null`) rather than treating missing observations as zero. Relationships must retain sample sizes and conservative wording.

## Fast local loop

```sh
npm ci
npm run prisma:generate
npm test
```

`npm test` runs the `unit` and `ui` Vitest projects without PostgreSQL, Redis, Next.js, provider credentials, or a browser install. Use `npm run test:unit` or `npm run test:ui` for focused work. The test-only `server-only` alias lets Vitest import server functions outside Next's bundler; it does not change the application's server/client boundary.

Existing focused security suites remain available:

```sh
npm run test:env
npm run test:encryption
```

They cover configuration/redaction and authenticated encryption/tampering/key-access failures. The Vitest setup provides a standard TypeScript runner for new tests; there is no need to rewrite every established script solely to change runners.

## Isolated repository/API tests

Start Docker Desktop or Docker Engine, then:

```sh
npm run test:infra
npm run test:integration
```

`compose.test.yaml` creates only a disposable PostgreSQL service at `127.0.0.1:55433`, using database `vibejournal_test`. It has its own Compose project and temporary storage, not the development database volume. `test:infra:down` removes the service; its data is disposable.

The runner applies committed migrations, supplies synthetic auth/encryption configuration, starts Next.js on `127.0.0.1:3200` with a separate `.next-test-dev` build directory, and stops that server afterward. It rejects a reused server and only accepts a loopback `TEST_DATABASE_URL` whose database name is exactly `vibejournal_test`. The app and cleanup code receive the same database URL. Personal `.env` credentials, AI/Google providers, and Redis are overridden for this isolated run; ignored environment files are not modified.

Tests create uniquely named accounts and delete only their fixtures in teardown. The existing auth suite's throttle cleanup is safe here because this database is dedicated to tests. No test truncates the development database. Do not run integration and E2E concurrently: they intentionally share test port 3200 and the test build directory.

The integration command runs:

1. Three direct repository tests against PostgreSQL.
2. The existing authentication API suite (hashing, CSRF, ownership, forged updates, throttling, password changes, deletion and session revocation).
3. The journal REST suite (CRUD, nullable values, errors, ownership, cursor boundaries and pagination).
4. The mood-trend API suite (empty and sparse 7/30/90-day ranges, archive/future exclusions and account isolation).

The analytics fixture now creates valid encrypted entries through the public API before adjusting dates/archive status for deterministic boundary tests. It no longer inserts plaintext rows that violate the current storage constraints.

## Six browser scenarios

```sh
npx playwright install chromium
npm run test:infra
npm run test:e2e
```

For an already installed local Chrome, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` is supported. CI installs Playwright Chromium. The runner applies migrations and supplies the same isolated environment; Playwright manages the test server with `reuseExistingServer: false`. Browser contexts are isolated, test accounts are cleaned up, and workers/retries are set to 1/0. A failed run is a failure, not silently retried into a pass.

Use roles, labels, visible text, URL transitions, and observable appearance. Wait for those conditions with Playwright assertions, not `waitForTimeout`. API setup is used outside the registration journey so account creation UI is not repeated in every test. Confirmation cancellation and completion are tested in the real browser because native dialog/focus/sync behavior matters.

The suite covers the requested behaviors in six focused tests:

| Scenario                       | Coverage                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Register and journal lifecycle | Register through the UI, create and sync, view, edit and reload, cancel deletion, confirm deletion                                                                                         |
| Login and session              | Login through the UI, persist theme across navigation/refresh, logout and protected-route redirect                                                                                         |
| Dashboard mood update          | Empty check-in becomes complete; creating mood 4 and editing to 8 updates the summary and accessible trend table                                                                           |
| Analytics visibility           | Empty state, five days of real encrypted entries, insight/sleep/exercise/tag sections, 7/30/90-day tables with missing-day gaps                                                            |
| AI-disabled privacy            | Consent defaults off; journals remain readable, automatic analysis is skipped despite a forged client flag, manual/weekly analysis is denied, and no analysis records are stored           |
| Unauthorized access            | Other-account detail/edit pages show generic not-found; foreign API reads match nonexistent IDs, writes/deletion fail without changing the owner's entry, and anonymous access is rejected |

AI privacy assertions inspect server responses and persisted outcomes, not just browser traffic. This suite runs with external AI disabled; it does not claim to observe server-to-provider network egress. Provider-call suppression is a separate service/consent contract-test responsibility.

Traces and screenshots are retained only on failure in ignored `test-results/` and `playwright-report/`. They contain synthetic journal content/accounts, but should still be treated as private diagnostic artifacts. CI retains failed-run artifacts for seven days.

## CI and extended checks

`.github/workflows/tests.yml` runs on every pull request and push, and supports manual dispatch. Both jobs install locked dependencies with `npm ci` on Node.js 22. The fast job explicitly checks the Prisma schema, ESLint, styles, formatting, TypeScript, unit/UI behavior, environment validation, encryption, and the production build. Prisma client and Next.js types are generated before typechecking so fresh checkouts do not depend on local build artifacts. The PostgreSQL 17 job applies migrations to an isolated test database and runs repository/API integration tests plus the six browser scenarios. Jobs have time limits, read-only repository permissions, and cancellation of superseded runs. It requires no production secrets or external provider calls. Workflow execution itself must be observed in GitHub; local success is not a claim that hosted CI has run.

Run specialized suites when their area changes rather than making every browser scenario part of the default PR gate:

- Accessibility: the existing `test:a11y` browser audit and periodic manual screen-reader checks.
- Offline/drafts/conflicts: existing focused scripts for refresh survival, offline queues, replay/idempotency, and conflict resolution.
- Privacy: export, account-deletion, audit, and encryption-persistence scripts.
- Providers/caching: AI/music contract tests, consent, Redis expiry/outage and durable rate-limit behavior.

These retained scripts have not all been re-certified by this change. Some use their own environment/fixture loaders and default to port 3000; review their configuration before direct execution, and move them into the isolated runner as they are maintained. Do not interpret an unexecuted legacy suite as passing. External Google/KMS/vendor integration needs a separately configured sandbox smoke test, not production credentials in ordinary CI.

The browser suite uses a development server to exercise encrypted journals with development-only test keys. Production build checks and `test:env-startup` cover build/startup separately. Add a production/KMS-backed smoke test only when sandbox infrastructure exists; never weaken production encryption checks to run E2E.

## Keeping the suite balanced

Add a regression at the lowest layer that reproduces the user-visible defect. Test representative boundaries, empty/sparse/error cases, and security invariants. Favor deterministic inputs and domain outcomes over blanket snapshots or arbitrary coverage percentages. There is no global 100% coverage target: an assertion that merely mirrors the implementation is not useful coverage.

Add a browser journey only when an important cross-layer behavior is otherwise unprotected. A new analytics formula normally needs unit cases and perhaps one API contract assertion, not another browser flow. Keep known failures visible; fix or explicitly track flaky tests rather than increasing sleeps/retries. Periodically review duplicated assertions, slow setup, and fixtures against schema migrations.

References: [Vitest projects](https://vitest.dev/guide/projects), [React Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/), [Playwright-managed web servers](https://playwright.dev/docs/test-webserver).
