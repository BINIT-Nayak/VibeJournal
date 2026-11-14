CREATE TABLE "JournalMutationReceipt" (
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalMutationReceipt_pkey" PRIMARY KEY ("userId", "key"),
  CONSTRAINT "JournalMutationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JournalMutationReceipt_userId_entryId_idx" ON "JournalMutationReceipt"("userId", "entryId");
