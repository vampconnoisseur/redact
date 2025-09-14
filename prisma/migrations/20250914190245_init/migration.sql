/*
  Warnings:

  - Added the required column `decryptionKey` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `redactionData` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AccessLevel" AS ENUM ('REDACTED', 'ORIGINAL');

-- AlterTable
ALTER TABLE "public"."Document" ADD COLUMN     "decryptionKey" TEXT NOT NULL,
ADD COLUMN     "redactionData" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "public"."SharedDocument" ADD COLUMN     "accessLevel" "public"."AccessLevel" NOT NULL DEFAULT 'REDACTED';
