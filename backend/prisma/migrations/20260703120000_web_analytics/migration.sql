-- CreateTable
CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "country" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "device" TEXT,
    "language" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebSession_startedAt_idx" ON "WebSession"("startedAt");

-- CreateIndex
CREATE INDEX "WebSession_country_idx" ON "WebSession"("country");

-- CreateIndex
CREATE INDEX "WebEvent_sessionId_idx" ON "WebEvent"("sessionId");

-- CreateIndex
CREATE INDEX "WebEvent_type_idx" ON "WebEvent"("type");

-- CreateIndex
CREATE INDEX "WebEvent_createdAt_idx" ON "WebEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "WebEvent" ADD CONSTRAINT "WebEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WebSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
