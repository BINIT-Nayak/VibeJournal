-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "allowExplicit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dislikedGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "favoriteGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferredLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];

