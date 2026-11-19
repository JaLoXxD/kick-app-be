-- CreateTable
CREATE TABLE "alert_configs" (
    "eventType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "textTemplate" TEXT NOT NULL,
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsTemplate" TEXT NOT NULL,
    "voiceProfileId" TEXT,
    "imageFile" TEXT,
    "audioFile" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 6,
    "fontFamily" TEXT NOT NULL DEFAULT 'Montserrat',
    "fontSize" INTEGER NOT NULL DEFAULT 48,
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "outlineColor" TEXT NOT NULL DEFAULT '#000000',
    "outlineWidth" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_configs_pkey" PRIMARY KEY ("eventType")
);
