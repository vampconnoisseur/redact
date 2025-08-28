/*
  Warnings:

  - You are about to drop the column `s3Url` on the `Document` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[s3Key]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `s3Key` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Document_s3Url_key";

-- AlterTable
ALTER TABLE "public"."Document" DROP COLUMN "s3Url",
ADD COLUMN     "s3Key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Document_s3Key_key" ON "public"."Document"("s3Key");
