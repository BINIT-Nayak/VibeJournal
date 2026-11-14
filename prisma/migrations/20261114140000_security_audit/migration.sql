CREATE TABLE "SecurityAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "event" TEXT NOT NULL CHECK ("event" IN ('login','logout','password.change','password.reset','data.export','account.delete','ai.preference')),
  "outcome" TEXT NOT NULL CHECK ("outcome" IN ('requested','succeeded','denied','failed')),
  "userId" TEXT,
  "reason" TEXT CHECK ("reason" IN ('invalid_input','invalid_credentials','unauthorized','invalid_origin','rate_limited','unavailable','reauth_required')),
  "provider" TEXT CHECK ("provider" IN ('credentials','google')),
  "enabled" BOOLEAN,
  CONSTRAINT "SecurityAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK ("enabled" IS NULL OR "event" = 'ai.preference'),
  CHECK ("provider" IS NULL OR "event" = 'login'),
  CHECK ("event" <> 'account.delete' OR "outcome" <> 'succeeded' OR "userId" IS NULL)
);
CREATE INDEX "SecurityAuditEvent_userId_createdAt_idx" ON "SecurityAuditEvent"("userId","createdAt");
CREATE INDEX "SecurityAuditEvent_createdAt_idx" ON "SecurityAuditEvent"("createdAt");
