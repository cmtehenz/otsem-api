/*
  Warnings:

  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `has2FA` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `hasBiometric` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `hasPin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `kycStatus` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `notificationsEnabled` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `preferredCurrency` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profileImage` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `EmailVerification` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "address",
DROP COLUMN "emailVerified",
DROP COLUMN "has2FA",
DROP COLUMN "hasBiometric",
DROP COLUMN "hasPin",
DROP COLUMN "kycStatus",
DROP COLUMN "lastLoginAt",
DROP COLUMN "notificationsEnabled",
DROP COLUMN "preferredCurrency",
DROP COLUMN "profileImage";

-- DropTable
DROP TABLE "public"."EmailVerification";
