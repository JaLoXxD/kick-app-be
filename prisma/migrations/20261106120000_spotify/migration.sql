-- CreateTable
CREATE TABLE "spotify_auth" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "displayName" TEXT,
    "product" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spotify_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spotify_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "playCommand" TEXT NOT NULL DEFAULT '!play',
    "revokeCommand" TEXT NOT NULL DEFAULT '!revoke',
    "perUserWindowMinutes" INTEGER NOT NULL DEFAULT 60,
    "minGapMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 20,
    "maxDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "blockExplicit" BOOLEAN NOT NULL DEFAULT false,
    "blockedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leadSeconds" INTEGER NOT NULL DEFAULT 30,
    "replyInChat" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spotify_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spotify_requests" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "spotify_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spotify_requests_status_createdAt_idx" ON "spotify_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "spotify_requests_username_createdAt_idx" ON "spotify_requests"("username", "createdAt");
