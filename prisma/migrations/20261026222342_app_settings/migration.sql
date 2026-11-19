-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "readMode" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "maxChars" INTEGER NOT NULL,
    "userCooldownSeconds" INTEGER NOT NULL,
    "dailyCharCap" INTEGER NOT NULL,
    "blockedWords" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
