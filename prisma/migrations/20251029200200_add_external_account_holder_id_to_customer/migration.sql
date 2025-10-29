/*
  Warnings:

  - A unique constraint covering the columns `[externalAccountHolderId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "externalAccountHolderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalAccountHolderId_key" ON "Customer"("externalAccountHolderId");
