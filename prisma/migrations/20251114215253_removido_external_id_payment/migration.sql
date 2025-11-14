/*
  Warnings:

  - You are about to drop the column `externalId` on the `Payment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Payment_externalId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "externalId";
