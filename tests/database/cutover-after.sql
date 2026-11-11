DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MoodEntry") THEN RAISE EXCEPTION 'Legacy rows remain'; END IF;
  IF (SELECT count(*) FROM "JournalEntry" WHERE id IN ('move-full', 'move-null')) <> 2 THEN
    RAISE EXCEPTION 'Missing transferred records';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "JournalEntry" WHERE id = 'move-full'
    AND "userId" = 'move-a' AND mood = 'hopeful' AND "moodScore" = 8 AND "energyScore" = 7
    AND stress = 3 AND content = 'Keep my reflection' AND "sleepHours" = 7.5
    AND "exerciseMinutes" = 25 AND exercised = true AND "socialScore" = 6
    AND "voiceNote" = 'Keep transcript' AND "photoNames" = ARRAY['photo.png']
    AND tags = ARRAY['work','rest','work',' '] AND "archivedAt" = '2026-01-03'
    AND "createdAt" = '2026-01-01' AND "updatedAt" = '2026-01-02') THEN
    RAISE EXCEPTION 'Full record changed during transfer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "JournalEntry" WHERE id = 'move-null' AND content = ''
    AND "energyScore" = 1 AND "moodScore" = 1 AND "sleepHours" IS NULL
    AND exercised IS NULL AND "socialScore" IS NULL AND "voiceNote" IS NULL
    AND "archivedAt" IS NULL) THEN RAISE EXCEPTION 'Null values were not preserved'; END IF;
  IF (SELECT array_agg(t.name ORDER BY jt.position) FROM "JournalTag" jt
    JOIN "Tag" t ON t.id = jt."tagId" WHERE jt."journalEntryId" = 'move-full')
    IS DISTINCT FROM ARRAY['work','rest'] THEN RAISE EXCEPTION 'Tag order or deduplication failed'; END IF;
  IF (SELECT count(*) FROM "Tag" WHERE name = 'work') <> 2 THEN
    RAISE EXCEPTION 'Different users must have separate tags';
  END IF;
END $$;
