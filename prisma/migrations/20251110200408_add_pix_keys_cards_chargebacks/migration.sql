-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "PixKeyStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "CardTransactionStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'CANCELED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CardTransactionType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ChargebackStatus" AS ENUM ('OPENED', 'UNDER_ANALYSIS', 'WON', 'LOST', 'CANCELED');

-- CreateEnum
CREATE TYPE "ChargebackReason" AS ENUM ('FRAUD', 'PRODUCT_NOT_RECEIVED', 'PRODUCT_DEFECTIVE', 'DUPLICATE_CHARGE', 'CANCELED_RECURRING', 'OTHER');

-- CreateTable
CREATE TABLE "PixKey" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "keyType" "PixKeyType" NOT NULL,
    "keyValue" TEXT NOT NULL,
    "status" "PixKeyStatus" NOT NULL DEFAULT 'PENDING',
    "externalKeyId" TEXT,
    "accountType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "type" "CardTransactionType" NOT NULL,
    "status" "CardTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "cardLast4" TEXT NOT NULL,
    "cardBrand" TEXT NOT NULL,
    "authorizationCode" TEXT,
    "nsu" TEXT,
    "tid" TEXT,
    "merchantName" TEXT,
    "merchantCategory" TEXT,
    "description" TEXT,
    "hasChargeback" BOOLEAN NOT NULL DEFAULT false,
    "chargebackId" TEXT,
    "externalTxId" TEXT,
    "bankPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chargeback" (
    "id" TEXT NOT NULL,
    "cardTransactionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "ChargebackReason" NOT NULL,
    "status" "ChargebackStatus" NOT NULL DEFAULT 'OPENED',
    "customerEvidence" JSONB,
    "bankEvidence" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "favoredParty" TEXT,
    "notes" TEXT,
    "externalCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chargeback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PixKey_externalKeyId_key" ON "PixKey"("externalKeyId");

-- CreateIndex
CREATE INDEX "PixKey_customerId_status_idx" ON "PixKey"("customerId", "status");

-- CreateIndex
CREATE INDEX "PixKey_keyValue_idx" ON "PixKey"("keyValue");

-- CreateIndex
CREATE UNIQUE INDEX "PixKey_customerId_keyValue_key" ON "PixKey"("customerId", "keyValue");

-- CreateIndex
CREATE UNIQUE INDEX "CardTransaction_externalTxId_key" ON "CardTransaction"("externalTxId");

-- CreateIndex
CREATE INDEX "CardTransaction_customerId_status_createdAt_idx" ON "CardTransaction"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CardTransaction_status_idx" ON "CardTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Chargeback_cardTransactionId_key" ON "Chargeback"("cardTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Chargeback_externalCaseId_key" ON "Chargeback"("externalCaseId");

-- CreateIndex
CREATE INDEX "Chargeback_customerId_status_idx" ON "Chargeback"("customerId", "status");

-- CreateIndex
CREATE INDEX "Chargeback_status_openedAt_idx" ON "Chargeback"("status", "openedAt");

-- AddForeignKey
ALTER TABLE "PixKey" ADD CONSTRAINT "PixKey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_cardTransactionId_fkey" FOREIGN KEY ("cardTransactionId") REFERENCES "CardTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
