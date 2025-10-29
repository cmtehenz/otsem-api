/*
  Warnings:

  - You are about to drop the column `externalAccountHolderId` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[taxNumber]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Customer_externalAccountHolderId_key";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "externalAccountHolderId",
ADD COLUMN     "email" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "endToEnd" TEXT NOT NULL,
    "status" TEXT,
    "statusId" INTEGER,
    "valueCents" INTEGER,
    "refundDate" TIMESTAMP(3),
    "bankPayload" JSONB NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "endToEnd" TEXT NOT NULL,
    "identifier" TEXT,
    "paymentValue" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "receiverName" TEXT,
    "receiverTaxNumber" TEXT,
    "receiverBankCode" TEXT,
    "receiverBankBranch" TEXT,
    "receiverBankAccount" TEXT,
    "receiverISPB" TEXT,
    "receiverPixKey" TEXT,
    "payerName" TEXT,
    "payerTaxNumber" TEXT,
    "payerBankCode" TEXT,
    "payerBankBranch" TEXT,
    "payerBankAccount" TEXT,
    "payerISPB" TEXT,
    "status" TEXT,
    "statusId" INTEGER,
    "errorMessage" TEXT,
    "bankPayload" JSONB NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "endToEnd" TEXT NOT NULL,
    "accountHolderId" TEXT,
    "receiptValue" INTEGER NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "payerName" TEXT,
    "payerTaxNumber" TEXT,
    "payerBankCode" TEXT,
    "payerBankBranch" TEXT,
    "payerBankAccount" TEXT,
    "payerBankAccountDigit" TEXT,
    "payerISPB" TEXT,
    "payerMessage" TEXT,
    "receiverName" TEXT,
    "receiverTaxNumber" TEXT,
    "receiverBankCode" TEXT,
    "receiverBankBranch" TEXT,
    "receiverBankAccount" TEXT,
    "receiverBankAccountDigit" TEXT,
    "receiverISPB" TEXT,
    "receiverPixKey" TEXT,
    "status" TEXT,
    "statusId" INTEGER,
    "bankPayload" JSONB NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "endToEnd" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawBody" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "ip" TEXT,
    "signatureOk" BOOLEAN,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_endToEnd_key" ON "Refund"("endToEnd");

-- CreateIndex
CREATE INDEX "Refund_customerId_idx" ON "Refund"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_endToEnd_key" ON "Payment"("endToEnd");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_endToEnd_key" ON "Deposit"("endToEnd");

-- CreateIndex
CREATE INDEX "Deposit_customerId_idx" ON "Deposit"("customerId");

-- CreateIndex
CREATE INDEX "WebhookEvent_kind_idx" ON "WebhookEvent"("kind");

-- CreateIndex
CREATE INDEX "WebhookEvent_endToEnd_idx" ON "WebhookEvent"("endToEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_taxNumber_key" ON "Customer"("taxNumber");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
