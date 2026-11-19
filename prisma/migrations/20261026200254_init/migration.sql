-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fishVoiceId" TEXT NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_voice_mappings" (
    "id" TEXT NOT NULL,
    "kickUsername" TEXT NOT NULL,
    "voiceProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_voice_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kick_auth" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kick_auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_profiles_name_key" ON "voice_profiles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_voice_mappings_kickUsername_key" ON "user_voice_mappings"("kickUsername");

-- AddForeignKey
ALTER TABLE "user_voice_mappings" ADD CONSTRAINT "user_voice_mappings_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
