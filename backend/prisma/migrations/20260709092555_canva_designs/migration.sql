-- CreateEnum
CREATE TYPE "BrandTemplateCategory" AS ENUM ('flyer', 'social_post', 'banner');

-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateTable
CREATE TABLE "CanvaConnection" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvaOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectAfter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvaOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTemplate" (
    "id" TEXT NOT NULL,
    "canvaTemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BrandTemplateCategory" NOT NULL,
    "thumbnailUrl" TEXT,
    "fieldSchema" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "brandTemplateId" TEXT NOT NULL,
    "title" TEXT,
    "status" "DesignStatus" NOT NULL DEFAULT 'pending',
    "canvaJobId" TEXT NOT NULL,
    "canvaDesignId" TEXT,
    "editUrl" TEXT,
    "thumbnailUrl" TEXT,
    "exportedFileUrl" TEXT,
    "exportFormat" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanvaOAuthState_state_key" ON "CanvaOAuthState"("state");

-- CreateIndex
CREATE INDEX "CanvaOAuthState_createdAt_idx" ON "CanvaOAuthState"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandTemplate_canvaTemplateId_key" ON "BrandTemplate"("canvaTemplateId");

-- CreateIndex
CREATE INDEX "BrandTemplate_category_idx" ON "BrandTemplate"("category");

-- CreateIndex
CREATE INDEX "BrandTemplate_active_idx" ON "BrandTemplate"("active");

-- CreateIndex
CREATE INDEX "Design_brandTemplateId_idx" ON "Design"("brandTemplateId");

-- CreateIndex
CREATE INDEX "Design_status_idx" ON "Design"("status");

-- CreateIndex
CREATE INDEX "Design_createdAt_idx" ON "Design"("createdAt");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_brandTemplateId_fkey" FOREIGN KEY ("brandTemplateId") REFERENCES "BrandTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
