ALTER TABLE "JournalEntry" ADD COLUMN "privatePayload" TEXT, ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tag" ADD COLUMN "privateLabel" TEXT;
ALTER TABLE "JournalAnalysis" ADD COLUMN "privatePayload" TEXT;
CREATE TABLE "UserContentKey" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "purpose" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "environment" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "wrappingKeyId" TEXT NOT NULL, "wrapped" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserContentKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserContentKey_userId_purpose_version_key" ON "UserContentKey"("userId", "purpose", "version");
-- Enforce new writes immediately; historical rows are validated after backfill.
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_private_storage_check" CHECK (
  "privatePayload" IS NOT NULL AND "privatePayload" LIKE 'e1.%' AND "contentRevision" > 0
  AND "content" = '' AND "title" IS NULL AND "voiceNote" IS NULL AND "prompt" IS NULL
  AND cardinality("photoNames") = 0 AND cardinality("tags") = 0
) NOT VALID;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_private_storage_check" CHECK ("privateLabel" IS NOT NULL AND "privateLabel" LIKE 'e1.%' AND "name" LIKE 'h1:%') NOT VALID;
ALTER TABLE "JournalAnalysis" ADD CONSTRAINT "JournalAnalysis_private_storage_check" CHECK ("privatePayload" IS NOT NULL AND "privatePayload" LIKE 'e1.%' AND cardinality("themes") = 0 AND "reflectionPrompt" = '') NOT VALID;
ALTER TABLE "JournalMutationReceipt" ADD CONSTRAINT "JournalMutationReceipt_private_hash_check" CHECK ("payloadHash" LIKE 'e1.%') NOT VALID;
