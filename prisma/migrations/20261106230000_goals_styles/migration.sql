-- AlterTable
ALTER TABLE "goal_configs" ADD COLUMN "displayStyle" TEXT NOT NULL DEFAULT 'bar',
ADD COLUMN "liquid" BOOLEAN NOT NULL DEFAULT true;
