-- Remember upgraded legacy JWTs until their original expiration so that each one
-- can be exchanged for a persistent session only once.
CREATE TABLE "UsedLegacyRefreshToken" (
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedLegacyRefreshToken_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "UsedLegacyRefreshToken_expiresAt_idx"
ON "UsedLegacyRefreshToken"("expiresAt");
