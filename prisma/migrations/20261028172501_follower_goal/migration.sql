-- CreateTable
CREATE TABLE "goal_configs" (
    "id" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "goalCount" INTEGER NOT NULL DEFAULT 100,
    "textTemplate" TEXT NOT NULL DEFAULT 'Meta de seguidores: {actual}/{meta}',
    "textPosition" TEXT NOT NULL DEFAULT 'above',
    "fontFamily" TEXT NOT NULL DEFAULT 'Montserrat',
    "fontSize" INTEGER NOT NULL DEFAULT 28,
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "outlineColor" TEXT NOT NULL DEFAULT '#000000',
    "outlineWidth" INTEGER NOT NULL DEFAULT 2,
    "barWidth" INTEGER NOT NULL DEFAULT 600,
    "barHeight" INTEGER NOT NULL DEFAULT 36,
    "barRadius" INTEGER NOT NULL DEFAULT 18,
    "barColor" TEXT NOT NULL DEFAULT '#53fc18',
    "barColor2" TEXT NOT NULL DEFAULT '#2bd9a0',
    "trackColor" TEXT NOT NULL DEFAULT '#0b2540',
    "borderColor" TEXT NOT NULL DEFAULT '#ffffff',
    "borderWidth" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_configs_pkey" PRIMARY KEY ("id")
);
