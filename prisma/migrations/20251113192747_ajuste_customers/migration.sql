/*
  Warnings:

  - You are about to drop the column `rg` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "rg",
ADD COLUMN     "rgi" TEXT;
