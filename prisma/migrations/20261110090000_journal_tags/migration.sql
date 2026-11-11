BEGIN;

-- Existing production data must receive real, explicitly chosen scores first.
-- Never invent mood scores or erase entries to satisfy the required column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "JournalEntry") THEN
    RAISE EXCEPTION 'JournalEntry is not empty: provide a reviewed moodScore backfill before applying this migration';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "energyScore" INTEGER,
ADD COLUMN     "exercised" BOOLEAN,
ADD COLUMN     "moodScore" INTEGER NOT NULL,
ADD COLUMN     "sleepHours" DOUBLE PRECISION,
ADD COLUMN     "socialScore" INTEGER;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTag" (
    "journalEntryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "JournalTag_pkey" PRIMARY KEY ("journalEntryId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_id_userId_key" ON "Tag"("id", "userId");

-- CreateIndex
CREATE INDEX "JournalTag_tagId_userId_idx" ON "JournalTag"("tagId", "userId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_createdAt_idx" ON "JournalEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_id_userId_key" ON "JournalEntry"("id", "userId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTag" ADD CONSTRAINT "JournalTag_journalEntryId_userId_fkey" FOREIGN KEY ("journalEntryId", "userId") REFERENCES "JournalEntry"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTag" ADD CONSTRAINT "JournalTag_tagId_userId_fkey" FOREIGN KEY ("tagId", "userId") REFERENCES "Tag"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma 6 cannot express these CHECK constraints in schema.prisma.
ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_moodScore_check" CHECK ("moodScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "JournalEntry_energyScore_check" CHECK ("energyScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "JournalEntry_socialScore_check" CHECK ("socialScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "JournalEntry_sleepHours_check" CHECK ("sleepHours" BETWEEN 0 AND 24);

ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_name_check" CHECK (length(btrim("name")) > 0);

COMMIT;
