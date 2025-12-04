/*
  Warnings:

  - You are about to drop the column `spreadValue` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "spreadValue";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "spreadValue" DECIMAL(5,2) DEFAULT 0.95;
