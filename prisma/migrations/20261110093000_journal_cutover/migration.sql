BEGIN;

-- Prevent legacy writes during the atomic copy/verification/removal.
LOCK TABLE "MoodEntry" IN ACCESS EXCLUSIVE MODE;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "exerciseMinutes" INTEGER,
ADD COLUMN     "mood" "Mood",
ADD COLUMN     "photoNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stress" INTEGER,
ADD COLUMN     "voiceNote" TEXT;

-- AlterTable
ALTER TABLE "JournalTag" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Preserve every existing field; map the recorded valence directly to moodScore.
INSERT INTO "JournalEntry" (
  "id", "userId", "content", "moodScore", "energyScore", "sleepHours", "exercised",
  "socialScore", "tags", "createdAt", "updatedAt", "mood", "stress", "exerciseMinutes",
  "voiceNote", "photoNames", "archivedAt"
)
SELECT "id", "userId", COALESCE("note", ''), "valence", "energy", "sleepHours",
  CASE WHEN "exerciseMinutes" IS NULL THEN NULL ELSE "exerciseMinutes" > 0 END,
  "socialLevel", COALESCE("tags", ARRAY[]::TEXT[]), "createdAt", "updatedAt", "mood", "stress",
  "exerciseMinutes", "voiceNote", COALESCE("photoNames", ARRAY[]::TEXT[]), "archivedAt"
FROM "MoodEntry";

INSERT INTO "Tag" ("id", "userId", "name")
SELECT 'migrated_' || md5(json_build_array(e."userId", t.name)::TEXT), e."userId", t.name
FROM "JournalEntry" e CROSS JOIN LATERAL unnest(e."tags") AS t(name)
WHERE length(btrim(t.name)) > 0
GROUP BY e."userId", t.name
ON CONFLICT ("userId", "name") DO NOTHING;

INSERT INTO "JournalTag" ("journalEntryId", "tagId", "userId", "position")
SELECT e."id", tag."id", e."userId", (MIN(t.ordinality) - 1)::INTEGER
FROM "JournalEntry" e
CROSS JOIN LATERAL unnest(e."tags") WITH ORDINALITY AS t(name, ordinality)
JOIN "Tag" tag ON tag."userId" = e."userId" AND tag."name" = t.name
GROUP BY e."id", tag."id", e."userId"
ON CONFLICT ("journalEntryId", "tagId") DO NOTHING;

-- Refuse to remove the source unless all fields and nonblank tags were copied.
DO $$
BEGIN
  IF EXISTS (
    SELECT "id", "userId", COALESCE("note", ''), "valence", "energy", "sleepHours",
      "socialLevel", COALESCE("tags", ARRAY[]::TEXT[]), "createdAt", "updatedAt", "mood",
      "stress", "exerciseMinutes", "voiceNote", COALESCE("photoNames", ARRAY[]::TEXT[]), "archivedAt"
    FROM "MoodEntry"
    EXCEPT
    SELECT "id", "userId", "content", "moodScore", "energyScore", "sleepHours",
      "socialScore", "tags", "createdAt", "updatedAt", "mood", "stress", "exerciseMinutes",
      "voiceNote", "photoNames", "archivedAt" FROM "JournalEntry"
  ) THEN RAISE EXCEPTION 'Journal cutover failed: field verification mismatch'; END IF;
  IF EXISTS (
    SELECT e."id", e."userId", t.name FROM "JournalEntry" e,
      LATERAL unnest(e."tags") AS t(name) WHERE length(btrim(t.name)) > 0
    EXCEPT
    SELECT jt."journalEntryId", jt."userId", t."name"
      FROM "JournalTag" jt JOIN "Tag" t ON t."id" = jt."tagId"
  ) THEN RAISE EXCEPTION 'Journal cutover failed: tag verification mismatch'; END IF;
END $$;

-- Transfer, rather than leave a second stale copy of private journal data.
DELETE FROM "MoodEntry";

COMMIT;
