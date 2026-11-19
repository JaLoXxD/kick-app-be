-- AlterTable
ALTER TABLE "points_configs" ADD COLUMN "duelsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "duelCommand" TEXT NOT NULL DEFAULT '!duelo',
ADD COLUMN "acceptCommand" TEXT NOT NULL DEFAULT '!aceptar',
ADD COLUMN "declineCommand" TEXT NOT NULL DEFAULT '!rechazar',
ADD COLUMN "duelMinBet" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "duelMaxBet" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "duelFeePercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "duelTimeoutSeconds" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "duelCooldownSeconds" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "points_commands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ttsTemplate" TEXT NOT NULL DEFAULT '',
    "voiceProfileId" TEXT,
    "audioFile" TEXT,
    "userCooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "globalCooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "replyTemplate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "known_followers" (
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "known_followers_pkey" PRIMARY KEY ("username")
);

-- CreateIndex
CREATE UNIQUE INDEX "points_commands_name_key" ON "points_commands"("name");
