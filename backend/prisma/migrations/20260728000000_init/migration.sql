-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('ALL', 'NONE', 'ONLY_WATCHING', 'SELECTED');

-- CreateTable
CREATE TABLE "AdminConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "jellyfinUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteUser" (
    "id" SERIAL NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarTag" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilityMatrix" (
    "id" SERIAL NOT NULL,
    "viewerId" INTEGER NOT NULL,
    "targetId" INTEGER NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VisibilityMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "shareMode" "ShareMode" NOT NULL DEFAULT 'ONLY_WATCHING',

    CONSTRAINT "SharingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jellyfinItemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "name" TEXT,
    "imageTag" TEXT,

    CONSTRAINT "SharedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybackState" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT,
    "itemType" TEXT,
    "seriesId" TEXT,
    "seriesName" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "imageTag" TEXT,
    "positionTicks" BIGINT,
    "runtimeTicks" BIGINT,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybackState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFavorite" (
    "id" SERIAL NOT NULL,
    "viewerId" INTEGER NOT NULL,
    "targetId" INTEGER NOT NULL,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteUser_jellyfinUserId_key" ON "SiteUser"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "VisibilityMatrix_targetId_idx" ON "VisibilityMatrix"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityMatrix_viewerId_targetId_key" ON "VisibilityMatrix"("viewerId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "SharingPreference_userId_key" ON "SharingPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedItem_userId_jellyfinItemId_key" ON "SharedItem"("userId", "jellyfinItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybackState_userId_key" ON "PlaybackState"("userId");

-- CreateIndex
CREATE INDEX "UserFavorite_targetId_idx" ON "UserFavorite"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorite_viewerId_targetId_key" ON "UserFavorite"("viewerId", "targetId");

-- AddForeignKey
ALTER TABLE "VisibilityMatrix" ADD CONSTRAINT "VisibilityMatrix_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityMatrix" ADD CONSTRAINT "VisibilityMatrix_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingPreference" ADD CONSTRAINT "SharingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedItem" ADD CONSTRAINT "SharedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackState" ADD CONSTRAINT "PlaybackState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SiteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
