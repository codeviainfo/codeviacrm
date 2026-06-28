-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "ScrapeCandidate" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "category" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "zone" TEXT,
    "rating" DOUBLE PRECISION,
    "website" TEXT,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "googlePlaceId" TEXT,
    "googleMapsUrl" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'pending',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeCandidate_jobId_idx" ON "ScrapeCandidate"("jobId");

-- CreateIndex
CREATE INDEX "ScrapeCandidate_status_idx" ON "ScrapeCandidate"("status");

-- CreateIndex
CREATE INDEX "ScrapeCandidate_hasWebsite_idx" ON "ScrapeCandidate"("hasWebsite");

-- AddForeignKey
ALTER TABLE "ScrapeCandidate" ADD CONSTRAINT "ScrapeCandidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScrapeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
