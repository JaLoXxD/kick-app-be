-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "normalizeVolume" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "last_event_overlays" (
    "type" TEXT NOT NULL,
    "lastUsername" TEXT NOT NULL DEFAULT '',
    "textTemplate" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL DEFAULT 'Montserrat',
    "fontSize" INTEGER NOT NULL DEFAULT 36,
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "variableColor" TEXT NOT NULL DEFAULT '#53fc18',
    "outlineColor" TEXT NOT NULL DEFAULT '#000000',
    "outlineWidth" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "last_event_overlays_pkey" PRIMARY KEY ("type")
);
