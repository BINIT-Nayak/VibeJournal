import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { DailyAggregate, CorrelationAggregate, TagAggregate } from "./data";

export function readAnalytics(userId: string, start: Date, asOf: Date) {
  // These predicates bind values and never read journal text or other users' rows.
  const filter = Prisma.sql`"userId" = ${userId} AND "archivedAt" IS NULL
    AND "createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC')
    AND "createdAt" <= (${asOf}::timestamptz AT TIME ZONE 'UTC')`;
  return prisma.$transaction(
    async (tx) => {
      const daily = await tx.$queryRaw<DailyAggregate[]>(Prisma.sql`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count, SUM("moodScore")::float8 AS "moodSum",
        SUM("energyScore")::float8 AS "energySum", COUNT("energyScore")::int AS "energyCount",
        SUM("sleepHours")::float8 AS "sleepSum", COUNT("sleepHours")::int AS "sleepCount",
        MIN("sleepHours")::float8 AS "sleepMin", MAX("sleepHours")::float8 AS "sleepMax",
        COUNT(*) FILTER (WHERE exercised IS TRUE)::int AS "exerciseYes",
        COUNT(*) FILTER (WHERE exercised IS FALSE)::int AS "exerciseNo",
        SUM("moodScore") FILTER (WHERE exercised IS TRUE)::float8 AS "yesMoodSum",
        SUM("moodScore") FILTER (WHERE exercised IS FALSE)::float8 AS "noMoodSum"
      FROM "JournalEntry" WHERE ${filter} GROUP BY date ORDER BY date`);
      const pairs = await tx.$queryRaw<CorrelationAggregate[]>(Prisma.sql`
      WITH entries AS (SELECT "createdAt", "moodScore", "energyScore", "sleepHours", exercised FROM "JournalEntry" WHERE ${filter})
      SELECT metric, COUNT(*)::int AS n, COUNT(DISTINCT "createdAt"::date)::int AS days,
        SUM(x)::float8 AS x, SUM(y)::float8 AS y, SUM(x*x)::float8 AS xx,
        SUM(y*y)::float8 AS yy, SUM(x*y)::float8 AS xy
      FROM entries CROSS JOIN LATERAL (VALUES
        ('energy', "energyScore"::float8, "moodScore"::float8),
        ('sleep', "sleepHours"::float8, "moodScore"::float8),
        ('exercise', CASE WHEN exercised IS TRUE THEN 1.0 WHEN exercised IS FALSE THEN 0.0 ELSE NULL END, "moodScore"::float8)
      ) AS values_by_metric(metric,x,y)
      WHERE x IS NOT NULL GROUP BY metric`);
      const tags = await tx.$queryRaw<TagAggregate[]>(Prisma.sql`
      WITH entries AS (SELECT id, "moodScore", "createdAt" FROM "JournalEntry" WHERE ${filter})
      SELECT tag.name AS tag, COUNT(*)::int AS "entryCount",
        COUNT(DISTINCT entries."createdAt"::date)::int AS "distinctDays",
        SUM(entries."moodScore")::float8 AS "moodSum" FROM entries
      JOIN "JournalTag" link ON link."journalEntryId" = entries.id AND link."userId" = ${userId}
      JOIN "Tag" tag ON tag.id = link."tagId" AND tag."userId" = ${userId}
      GROUP BY tag.name
      HAVING COUNT(*) >= 5 AND COUNT(DISTINCT entries."createdAt"::date) >= 5
      ORDER BY "entryCount" DESC, tag.name ASC LIMIT 20`);
      return { daily, pairs, tags };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
}
