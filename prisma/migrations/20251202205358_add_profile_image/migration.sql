/*
  Warnings:

  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive",
DROP COLUMN "role",
DROP COLUMN "updatedAt",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "has2FA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasBiometric" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kycStatus" TEXT,
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preferredCurrency" TEXT DEFAULT 'USD',
ADD COLUMN     "profileImage" TEXT;
