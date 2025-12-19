-- AlterTable
ALTER TABLE "PixKey" ADD COLUMN     "validationAttempted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validationAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "validationError" TEXT,
ADD COLUMN     "validationTxId" TEXT;
