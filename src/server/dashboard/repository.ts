import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { entryInclude } from "@/server/journal/repository";

type Stats = {
  journalCount: number;
  weeklyJournalCount: number;
  todayCount: number;
  averageMood: number | null;
  averageEnergy: number | null;
};
type Day = { date: string; averageMood: number; journalCount: number };

export function readDashboard(
  userId: string,
  startDate: string,
  today: string,
  timeZone: string,
  asOf: Date
) {
  return prisma.$transaction(
    async (tx) => {
      const stats = await tx.$queryRaw<Stats[]>`
      SELECT COUNT(*)::int AS "journalCount",
        COUNT(*) FILTER (WHERE "createdAt" >= ((${startDate}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC'))::int AS "weeklyJournalCount",
        COUNT(*) FILTER (WHERE "createdAt" >= ((${today}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC'))::int AS "todayCount",
        AVG("moodScore") FILTER (WHERE "createdAt" >= ((${startDate}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC'))::float8 AS "averageMood",
        AVG("energyScore") FILTER (WHERE "createdAt" >= ((${startDate}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC'))::float8 AS "averageEnergy"
      FROM "JournalEntry" WHERE "userId"=${userId} AND "archivedAt" IS NULL AND "createdAt" <= (${asOf}::timestamptz AT TIME ZONE 'UTC')`;
      const days = await tx.$queryRaw<Day[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS date,
        AVG("moodScore")::float8 AS "averageMood", COUNT(*)::int AS "journalCount"
      FROM "JournalEntry" WHERE "userId"=${userId} AND "archivedAt" IS NULL
        AND "createdAt" >= ((${startDate}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC') AND "createdAt" <= (${asOf}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY date ORDER BY date`;
      const recent = await tx.journalEntry.findMany({
        where: { userId, archivedAt: null, createdAt: { lte: asOf } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
        include: entryInclude,
      });
      const settings = await tx.userSettings.findUnique({ where: { userId } });
      return { stats: stats[0], days, recent, settings };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
}
