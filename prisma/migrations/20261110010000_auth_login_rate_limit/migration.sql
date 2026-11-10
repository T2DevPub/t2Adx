CREATE TABLE "AuthLoginAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthLoginAttempt_ipHash_key" ON "AuthLoginAttempt"("ipHash");
CREATE INDEX "AuthLoginAttempt_blockedUntil_idx" ON "AuthLoginAttempt"("blockedUntil");
