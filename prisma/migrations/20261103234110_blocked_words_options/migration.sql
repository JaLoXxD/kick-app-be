-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "blockSplitWords" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useDefaultBlockedWords" BOOLEAN NOT NULL DEFAULT true;
