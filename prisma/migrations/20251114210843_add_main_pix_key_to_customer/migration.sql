/*
  Warnings:

  - A unique constraint covering the columns `[mainPixKey]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "mainPixKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mainPixKey_key" ON "Customer"("mainPixKey");
