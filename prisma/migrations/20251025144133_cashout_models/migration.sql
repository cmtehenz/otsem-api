-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "endToEndId" TEXT,
    "bankRequest" JSONB,
    "bankResponse" JSONB,
    "error" TEXT,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryTaxNumber" TEXT NOT NULL,
    "pixKey" TEXT NOT NULL,
    "pixKeyType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "debitTxId" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_requestId_key" ON "Payout"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_endToEndId_key" ON "Payout"("endToEndId");

-- CreateIndex
CREATE INDEX "Payout_walletId_status_createdAt_idx" ON "Payout"("walletId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_debitTxId_fkey" FOREIGN KEY ("debitTxId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
