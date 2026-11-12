import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";

export async function hasConsent(userId: string) {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { aiConsent: true },
  });
  return row?.aiConsent === true;
}

export function readTopThemes(userId: string, start: Date, asOf: Date) {
  // Only current structured themes. Never select journal content, titles or AI prose.
  return prisma.$queryRaw<Array<{ theme: string; entries: number; days: number }>>(Prisma.sql`
    SELECT lower(trim(theme)) AS theme, COUNT(DISTINCT j.id)::int AS entries,
      COUNT(DISTINCT j."createdAt"::date)::int AS days
    FROM "JournalAnalysis" a JOIN "JournalEntry" j
      ON j.id = a."journalEntryId" AND j."userId" = a."userId"
    CROSS JOIN LATERAL unnest(a.themes) AS theme
    WHERE j."userId" = ${userId} AND j."archivedAt" IS NULL
      AND a."sourceUpdatedAt" = j."updatedAt"
      AND j."createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC')
      AND j."createdAt" <= (${asOf}::timestamptz AT TIME ZONE 'UTC')
      AND length(trim(theme)) BETWEEN 1 AND 80
    GROUP BY lower(trim(theme))
    HAVING COUNT(DISTINCT j."createdAt"::date) >= 2
    ORDER BY entries DESC, theme ASC LIMIT 5
  `);
}
