-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "maxRepeatedChars" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "repeatAction" TEXT NOT NULL DEFAULT 'shorten';
