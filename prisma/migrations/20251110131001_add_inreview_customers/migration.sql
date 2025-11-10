/*
  Warnings:

  - The values [received,processing] on the enum `AccountStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AccountStatus_new" AS ENUM ('not_requested', 'requested', 'approved', 'rejected', 'in_review');
ALTER TABLE "public"."Customer" ALTER COLUMN "accountStatus" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "accountStatus" TYPE "AccountStatus_new" USING ("accountStatus"::text::"AccountStatus_new");
ALTER TYPE "AccountStatus" RENAME TO "AccountStatus_old";
ALTER TYPE "AccountStatus_new" RENAME TO "AccountStatus";
DROP TYPE "public"."AccountStatus_old";
ALTER TABLE "Customer" ALTER COLUMN "accountStatus" SET DEFAULT 'not_requested';
COMMIT;
