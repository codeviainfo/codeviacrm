/*
  Warnings:

  - You are about to drop the column `brandTemplateId` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the column `canvaDesignId` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the column `canvaJobId` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the column `editUrl` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the column `exportFormat` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the column `exportedFileUrl` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnailUrl` on the `Design` table. All the data in the column will be lost.
  - You are about to drop the `BrandTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CanvaConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CanvaOAuthState` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `brief` to the `Design` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `Design` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DesignCategory" AS ENUM ('flyer', 'social_post', 'banner');

-- DropForeignKey
ALTER TABLE "Design" DROP CONSTRAINT "Design_brandTemplateId_fkey";

-- DropIndex
DROP INDEX "Design_brandTemplateId_idx";

-- AlterTable
ALTER TABLE "Design" DROP COLUMN "brandTemplateId",
DROP COLUMN "canvaDesignId",
DROP COLUMN "canvaJobId",
DROP COLUMN "editUrl",
DROP COLUMN "exportFormat",
DROP COLUMN "exportedFileUrl",
DROP COLUMN "thumbnailUrl",
ADD COLUMN     "brief" TEXT NOT NULL,
ADD COLUMN     "category" "DesignCategory" NOT NULL,
ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageMime" TEXT,
ADD COLUMN     "referenceImageUrl" TEXT;

-- DropTable
DROP TABLE "BrandTemplate";

-- DropTable
DROP TABLE "CanvaConnection";

-- DropTable
DROP TABLE "CanvaOAuthState";

-- DropEnum
DROP TYPE "BrandTemplateCategory";

-- CreateIndex
CREATE INDEX "Design_category_idx" ON "Design"("category");
