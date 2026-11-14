CREATE TABLE "AccountDeletionChallenge" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  CONSTRAINT "AccountDeletionChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AccountDeletionChallenge_userId_idx" ON "AccountDeletionChallenge"("userId");
CREATE INDEX "AccountDeletionChallenge_expiresAt_idx" ON "AccountDeletionChallenge"("expiresAt");
