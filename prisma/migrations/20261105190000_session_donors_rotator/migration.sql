-- CreateTable
CREATE TABLE "session_counters" (
    "id" TEXT NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "subs" INTEGER NOT NULL DEFAULT 0,
    "giftedSubs" INTEGER NOT NULL DEFAULT 0,
    "kicks" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "textTemplate" TEXT NOT NULL DEFAULT 'Hoy: +{seguidores} seguidores · {subs} subs · {kicks} KICKs',
    "fontFamily" TEXT NOT NULL DEFAULT 'Montserrat',
    "fontSize" INTEGER NOT NULL DEFAULT 32,
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "variableColor" TEXT NOT NULL DEFAULT '#53fc18',
    "outlineColor" TEXT NOT NULL DEFAULT '#000000',
    "outlineWidth" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kick_donations" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kick_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_boards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Top donadores',
    "entryTemplate" TEXT NOT NULL DEFAULT '{posicion}. {usuario} — {cantidad} KICKs',
    "limit" INTEGER NOT NULL DEFAULT 5,
    "period" TEXT NOT NULL DEFAULT 'all',
    "fontFamily" TEXT NOT NULL DEFAULT 'Montserrat',
    "fontSize" INTEGER NOT NULL DEFAULT 30,
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "variableColor" TEXT NOT NULL DEFAULT '#53fc18',
    "outlineColor" TEXT NOT NULL DEFAULT '#000000',
    "outlineWidth" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donor_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotator_configs" (
    "id" TEXT NOT NULL,
    "items" TEXT[] DEFAULT ARRAY['follower', 'subscriber', 'donors', 'session']::TEXT[],
    "intervalSeconds" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rotator_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kick_donations_createdAt_idx" ON "kick_donations"("createdAt");
