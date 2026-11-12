-- CreateTable
CREATE TABLE "JournalAnalysis" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "primaryEmotion" TEXT NOT NULL,
    "emotions" TEXT[],
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "themes" TEXT[],
    "estimatedEnergy" INTEGER NOT NULL,
    "reflectionPrompt" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalAnalysis_journalEntryId_key" ON "JournalAnalysis"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalAnalysis_userId_createdAt_idx" ON "JournalAnalysis"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalAnalysis_journalEntryId_userId_key" ON "JournalAnalysis"("journalEntryId", "userId");

-- AddForeignKey
ALTER TABLE "JournalAnalysis" ADD CONSTRAINT "JournalAnalysis_journalEntryId_userId_fkey" FOREIGN KEY ("journalEntryId", "userId") REFERENCES "JournalEntry"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

