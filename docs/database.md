# Journal database schema

PostgreSQL is configured through `DATABASE_URL` and the existing Prisma 6 client.
`prisma/schema.prisma` is the source for generated TypeScript types. The migration
`20261110090000_journal_tags` extends the existing schema without resetting it.

## Models and ownership

- `User` retains existing account fields and owns journal entries and tags.
- `JournalEntry` has required `content` and integer `moodScore`, optional `title`,
  `energyScore`, `sleepHours`, `exercised`, and `socialScore`, plus `createdAt` and
  `updatedAt`. IDs use Prisma-generated CUIDs. Content is PostgreSQL text.
- `Tag` belongs to one user. `(userId, name)` is unique, so different users can
  use the same label. Names are case-sensitive and must not be blank; any future
  trimming/case-normalization policy should be implemented consistently at input.
- `JournalTag` is an explicit many-to-many join. Its composite primary key prevents
  attaching the same tag to the same entry twice. Its `userId` participates in both
  foreign keys, so PostgreSQL rejects links between different users' data.

Deleting an entry or tag deletes its join rows, but not the other related entity.
Deleting a user cascades to their entries, tags, and join rows. Ownership constraints
do not replace authentication and user-scoped queries in the application.

## Validation and indexes

PostgreSQL CHECK constraints enforce mood, energy, and social scores of 1–10;
optional scores accept NULL. Sleep accepts fractional hours from 0 through 24.
`exercised` is nullable: NULL means unrecorded, distinct from false. No score defaults
are supplied, so missing input cannot silently become a measured value.

Prisma 6 does not represent these checks in its schema language; they are maintained
in the SQL migration. See the [Prisma 6 CHECK constraint documentation](https://www.prisma.io/docs/orm/v6/more/troubleshooting/check-constraints).

- `(userId, createdAt)` supports a user's chronological timeline and date ranges;
  PostgreSQL can scan this index in reverse for newest-first queries.
- `(userId, name)` supports tag lookup and enforces per-user uniqueness.
- `(id, userId)` unique indexes on entries and tags support ownership-aware foreign keys.
- The join primary key starts with `journalEntryId`; `(tagId, userId)` supports reverse
  lookup and tag deletion. A separate single-column entry index is unnecessary.

`createdAt` defaults to database time. `updatedAt` is maintained by Prisma's
`@updatedAt`; raw SQL writers must set it themselves.

## Compatibility and rollout

The UI/API now reads and writes `JournalEntry` and normalized `Tag`/`JournalTag`
relations. The existing browser-facing entry shape is preserved, so the forms,
charts, exports, and filters continue to work. Tag replacement and entry updates
run in one transaction; tag order is stored in `JournalTag.position`.

`20261110093000_journal_cutover` adds compatibility fields for mood labels, stress,
exercise minutes, transcripts, photo names, and archive status. It transfers all
`MoodEntry` rows, retaining IDs, ownership, and timestamps. Recorded `valence` maps
to `moodScore`, `energy` to `energyScore`, `socialLevel` to `socialScore`, and `note`
to `content` (a NULL note becomes empty text). `exercised` is derived from recorded
exercise minutes, preserving NULL when minutes are unknown.

The original tag array remains in `legacyTags` (`@map("tags")`). Normalized links
preserve the first occurrence of each nonblank tag, in order, per user. Blank and
duplicate legacy values remain in the legacy array for fidelity, but are not shown
as duplicate/blank normalized tags. The original `prompt` column is also retained.

The transfer locks the source table and verifies copied fields and tag links before
removing the source rows, all within one PostgreSQL transaction. Constraints or ID
collisions abort the transaction rather than silently dropping or overwriting data.
The old `MoodEntry` table remains empty for now; no application code uses it. Do not
run an older app version against this database: it would read/write that retired table.

The earlier `20261110090000_journal_tags` migration requires its old `JournalEntry`
table to be empty because it adds a mandatory score. An environment with preexisting
unscored `JournalEntry` rows needs a reviewed backfill before that migration.

For deployment, stop old app writers, apply migrations, generate the client, then
start this app version. The migration's verification protects the transfer; it does
not make concurrent old/new application deployments safe.

```bash
npm run prisma:deploy
npm run prisma:generate
```

## Verification

```bash
npx prisma validate
npm run test:db
npm run build
npm run typecheck
```

`test:db` requires `psql` and a PostgreSQL connection with permission to create a
schema. It replays the migration history into a uniquely named schema and tests
score ranges, nullable fields, tag ownership, uniqueness, indexes, cascading deletes,
rejection of unscored legacy entries, and full data-transfer fidelity. All test DDL and data are rolled back;
application tables and migration history are not changed.

With the local app running, `npm run test:api` verifies the migrated entry APIs,
login/session loading, tag replacement and ordering, archive/unarchive, invalid
integer rejection, nullable-field preservation, cross-user access, and deletion.
It creates two temporary accounts and removes them and their data in cleanup.
`TEST_APP_URL` can select a different test app; its database must match `DATABASE_URL`.
