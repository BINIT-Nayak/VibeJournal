-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "aiConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD COLUMN "privacyAcknowledged" BOOLEAN NOT NULL DEFAULT false;
