-- CreateTable
CREATE TABLE "muted_users" (
    "id" TEXT NOT NULL,
    "kickUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muted_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "muted_users_kickUsername_key" ON "muted_users"("kickUsername");
