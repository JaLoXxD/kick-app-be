-- CreateTable
CREATE TABLE "points_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pointsName" TEXT NOT NULL DEFAULT 'puntos',
    "pointsCommand" TEXT NOT NULL DEFAULT '!puntos',
    "rouletteCommand" TEXT NOT NULL DEFAULT '!ruleta',
    "perMessage" INTEGER NOT NULL DEFAULT 5,
    "messageCooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "followBonus" INTEGER NOT NULL DEFAULT 100,
    "subBonus" INTEGER NOT NULL DEFAULT 500,
    "giftSubBonus" INTEGER NOT NULL DEFAULT 300,
    "perKick" INTEGER NOT NULL DEFAULT 1,
    "rouletteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minBet" INTEGER NOT NULL DEFAULT 10,
    "maxBet" INTEGER NOT NULL DEFAULT 1000,
    "rouletteCooldownSeconds" INTEGER NOT NULL DEFAULT 30,
    "outcomes" JSONB NOT NULL DEFAULT '[{"label":"Pierdes","multiplier":0,"weight":62},{"label":"x2","multiplier":2,"weight":29},{"label":"x3","multiplier":3,"weight":7},{"label":"x10","multiplier":10,"weight":2}]',
    "replyInChat" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_balances" (
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "earned" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_balances_pkey" PRIMARY KEY ("username")
);

-- CreateTable
CREATE TABLE "points_log" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "points_balances_balance_idx" ON "points_balances"("balance");

-- CreateIndex
CREATE INDEX "points_log_createdAt_idx" ON "points_log"("createdAt");

-- CreateIndex
CREATE INDEX "points_log_username_createdAt_idx" ON "points_log"("username", "createdAt");
