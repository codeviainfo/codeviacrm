-- Add geographic fields to Client and ScrapeCandidate.
ALTER TABLE "Client" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "googleMapsUrl" TEXT;

ALTER TABLE "ScrapeCandidate" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "ScrapeCandidate" ADD COLUMN "longitude" DOUBLE PRECISION;
