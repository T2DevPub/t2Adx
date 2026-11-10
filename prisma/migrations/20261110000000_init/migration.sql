CREATE TABLE "Application" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "packageName" TEXT NOT NULL,
  "gamobAppId" TEXT, "appOs" TEXT, "appStatus" TEXT, "currency" TEXT NOT NULL DEFAULT 'USD',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata', "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RevenueDaily" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(38,20) NOT NULL, "currency" TEXT NOT NULL, "source" TEXT NOT NULL DEFAULT 'GAMOB',
  "rawPayload" JSONB, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RevenueDaily_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AdMetricDaily" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "impressions" BIGINT, "requests" BIGINT, "clicks" BIGINT, "matchedRequests" BIGINT,
  "ecpm" DECIMAL(38,20), "fillRate" DECIMAL(12,6), "ctr" DECIMAL(12,6), "showRate" DECIMAL(12,6), "cpc" DECIMAL(38,20),
  "rawPayload" JSONB, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdMetricDaily_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CountryMetric" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "countryCode" TEXT NOT NULL, "countryName" TEXT NOT NULL, "revenue" DECIMAL(38,20),
  "currency" TEXT NOT NULL, "impressions" BIGINT, "clicks" BIGINT, "ecpm" DECIMAL(38,20),
  "rawPayload" JSONB, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CountryMetric_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "amount" DECIMAL(38,20) NOT NULL,
  "currency" TEXT NOT NULL, "paidAt" TIMESTAMP(3) NOT NULL, "reference" TEXT,
  "method" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SyncJob" (
  "id" TEXT NOT NULL, "applicationId" TEXT, "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
  "recordsFetched" INTEGER NOT NULL DEFAULT 0, "message" TEXT, "details" JSONB,
  CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Application_packageName_key" ON "Application"("packageName");
CREATE UNIQUE INDEX "RevenueDaily_applicationId_date_currency_key" ON "RevenueDaily"("applicationId","date","currency");
CREATE INDEX "RevenueDaily_date_idx" ON "RevenueDaily"("date");
CREATE UNIQUE INDEX "AdMetricDaily_applicationId_date_key" ON "AdMetricDaily"("applicationId","date");
CREATE INDEX "AdMetricDaily_date_idx" ON "AdMetricDaily"("date");
CREATE UNIQUE INDEX "CountryMetric_applicationId_date_countryCode_currency_key" ON "CountryMetric"("applicationId","date","countryCode","currency");
CREATE INDEX "CountryMetric_date_idx" ON "CountryMetric"("date");
CREATE INDEX "Payment_applicationId_paidAt_idx" ON "Payment"("applicationId","paidAt");
CREATE INDEX "SyncJob_startedAt_idx" ON "SyncJob"("startedAt");
ALTER TABLE "RevenueDaily" ADD CONSTRAINT "RevenueDaily_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdMetricDaily" ADD CONSTRAINT "AdMetricDaily_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountryMetric" ADD CONSTRAINT "CountryMetric_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GamobCredential" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamobCredential_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GamobBreakdown" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "breakdownType" TEXT NOT NULL,
  "breakdownKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "dimensions" JSONB NOT NULL,
  "metrics" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamobBreakdown_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GamobBreakdown_applicationId_date_breakdownType_breakdownKey_key" ON "GamobBreakdown"("applicationId","date","breakdownType","breakdownKey");
CREATE INDEX "GamobBreakdown_date_breakdownType_idx" ON "GamobBreakdown"("date","breakdownType");
ALTER TABLE "GamobBreakdown" ADD CONSTRAINT "GamobBreakdown_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdUnit" (
  "id" TEXT NOT NULL,
  "gamobAdId" TEXT NOT NULL,
  "adName" TEXT NOT NULL,
  "adUnitId" TEXT,
  "adSize" TEXT,
  "adStatus" TEXT,
  "applicationId" TEXT NOT NULL,
  "rawPayload" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdUnit_gamobAdId_key" ON "AdUnit"("gamobAdId");
CREATE INDEX "AdUnit_applicationId_idx" ON "AdUnit"("applicationId");
ALTER TABLE "AdUnit" ADD CONSTRAINT "AdUnit_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
