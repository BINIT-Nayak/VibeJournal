INSERT INTO "User" (id, email, "updatedAt") VALUES
  ('user-a', 'a@example.invalid', now()), ('user-b', 'b@example.invalid', now());

INSERT INTO "JournalEntry" (id, "userId", content, "moodScore", "updatedAt")
VALUES ('entry-a', 'user-a', 'Optional fields omitted', 1, now());
INSERT INTO "JournalEntry" (id, "userId", title, content, "moodScore", "energyScore", "socialScore", "sleepHours", exercised, "updatedAt")
VALUES ('entry-b', 'user-b', 'Title', 'Full entry', 10, 10, 1, 24, false, now());

INSERT INTO "Tag" (id, "userId", name) VALUES
  ('tag-a', 'user-a', 'work'), ('tag-b', 'user-b', 'work');
INSERT INTO "JournalTag" ("journalEntryId", "tagId", "userId")
VALUES ('entry-a', 'tag-a', 'user-a');

DO $$
DECLARE
  column_name text;
  invalid_value integer;
BEGIN
  FOREACH column_name IN ARRAY ARRAY['moodScore', 'energyScore', 'socialScore'] LOOP
    FOREACH invalid_value IN ARRAY ARRAY[0, 11] LOOP
      BEGIN
        EXECUTE format('UPDATE "JournalEntry" SET %I = $1 WHERE id = $2', column_name)
          USING invalid_value, 'entry-a';
        RAISE EXCEPTION 'Accepted out-of-range score';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END LOOP;
  END LOOP;
  FOREACH invalid_value IN ARRAY ARRAY[-1, 25] LOOP
    BEGIN
      UPDATE "JournalEntry" SET "sleepHours" = invalid_value WHERE id = 'entry-a';
      RAISE EXCEPTION 'Accepted out-of-range sleep';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    UPDATE "JournalEntry" SET "moodScore" = NULL WHERE id = 'entry-a';
    RAISE EXCEPTION 'Accepted missing mood';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "JournalTag" VALUES ('entry-a', 'tag-b', 'user-a');
    RAISE EXCEPTION 'Accepted another user tag';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "JournalTag" VALUES ('entry-a', 'tag-b', 'user-b');
    RAISE EXCEPTION 'Accepted another user entry';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "JournalTag" VALUES ('entry-a', 'tag-a', 'user-a');
    RAISE EXCEPTION 'Accepted duplicate entry/tag';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "Tag" VALUES ('tag-duplicate', 'user-a', 'work');
    RAISE EXCEPTION 'Accepted duplicate tag name for user';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "Tag" VALUES ('tag-empty', 'user-a', '  ');
    RAISE EXCEPTION 'Accepted blank tag name';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema()
    AND indexname = 'JournalEntry_userId_createdAt_idx') THEN
    RAISE EXCEPTION 'Missing timeline index';
  END IF;
END $$;

-- Fractional sleep and nullable optional values are valid.
UPDATE "JournalEntry" SET "energyScore" = NULL, "socialScore" = NULL,
  "sleepHours" = 7.5, exercised = NULL WHERE id = 'entry-a';

DELETE FROM "Tag" WHERE id = 'tag-a';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "JournalTag") OR NOT EXISTS (SELECT 1 FROM "JournalEntry" WHERE id = 'entry-a') THEN
    RAISE EXCEPTION 'Tag deletion should remove links, not entries';
  END IF;
END $$;

INSERT INTO "Tag" VALUES ('tag-new', 'user-a', 'rest');
INSERT INTO "JournalTag" VALUES ('entry-a', 'tag-new', 'user-a');
DELETE FROM "JournalEntry" WHERE id = 'entry-a';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "JournalTag") OR NOT EXISTS (SELECT 1 FROM "Tag" WHERE id = 'tag-new') THEN
    RAISE EXCEPTION 'Entry deletion should remove links, not tags';
  END IF;
END $$;

INSERT INTO "JournalTag" VALUES ('entry-b', 'tag-b', 'user-b');
DELETE FROM "User" WHERE id = 'user-b';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "JournalEntry" WHERE "userId" = 'user-b')
    OR EXISTS (SELECT 1 FROM "Tag" WHERE "userId" = 'user-b')
    OR EXISTS (SELECT 1 FROM "JournalTag") THEN
    RAISE EXCEPTION 'Account deletion should cascade';
  END IF;
END $$;
