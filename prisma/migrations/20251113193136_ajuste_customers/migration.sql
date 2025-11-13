/*
  Warnings:

  - You are about to drop the column `rgi` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "rgi",
ADD COLUMN     "rg" TEXT;
