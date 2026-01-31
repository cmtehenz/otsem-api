-- =====================================================
-- Migration: schema_improvements
-- Todas as alterações são ADITIVAS e preservam dados.
-- =====================================================

-- CreateEnum
CREATE TYPE "KycUpgradeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- =====================================================
-- Novos campos updatedAt/createdAt (sem perda de dados)
-- =====================================================

-- AlterTable: User - adicionar updatedAt
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Address - adicionar createdAt e updatedAt
ALTER TABLE "Address" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Ownership - adicionar createdAt e updatedAt
ALTER TABLE "Ownership" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Refund - adicionar updatedAt
ALTER TABLE "Refund" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- Conversão segura de String para Enum (preserva dados)
-- Usa ALTER COLUMN TYPE USING ao invés de DROP+ADD
-- =====================================================

-- KycUpgradeRequest.status: String -> KycUpgradeRequestStatus
ALTER TABLE "kyc_upgrade_requests"
  ALTER COLUMN "status" SET DEFAULT NULL;
ALTER TABLE "kyc_upgrade_requests"
  ALTER COLUMN "status" TYPE "KycUpgradeRequestStatus" USING "status"::"KycUpgradeRequestStatus";
ALTER TABLE "kyc_upgrade_requests"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Payout.pixKeyType: String -> PixKeyType
ALTER TABLE "Payout"
  ALTER COLUMN "pixKeyType" TYPE "PixKeyType" USING "pixKeyType"::"PixKeyType";

-- Account.pixKeyType: String -> PixKeyType (nullable)
ALTER TABLE "accounts"
  ALTER COLUMN "pixKeyType" SET DEFAULT NULL;
ALTER TABLE "accounts"
  ALTER COLUMN "pixKeyType" TYPE "PixKeyType" USING "pixKeyType"::"PixKeyType";
ALTER TABLE "accounts"
  ALTER COLUMN "pixKeyType" SET DEFAULT 'RANDOM';

-- AffiliateCommission.status: String -> CommissionStatus
ALTER TABLE "AffiliateCommission"
  ALTER COLUMN "status" SET DEFAULT NULL;
ALTER TABLE "AffiliateCommission"
  ALTER COLUMN "status" TYPE "CommissionStatus" USING "status"::"CommissionStatus";
ALTER TABLE "AffiliateCommission"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Conversion.pixDestKeyType: String -> PixKeyType (nullable)
ALTER TABLE "conversions"
  ALTER COLUMN "pixDestKeyType" TYPE "PixKeyType" USING "pixDestKeyType"::"PixKeyType";

-- =====================================================
-- Novos índices compostos para queries frequentes
-- =====================================================

-- KycUpgradeRequest: index em status (agora como enum)
CREATE INDEX "kyc_upgrade_requests_status_idx" ON "kyc_upgrade_requests"("status");

-- Wallet: index para busca por isMain
CREATE INDEX "Wallet_customerId_isMain_idx" ON "Wallet"("customerId", "isMain");

-- Transaction: index composto para queries accountId+type+status
CREATE INDEX "transactions_accountId_type_status_idx" ON "transactions"("accountId", "type", "status");

-- AffiliateCommission: index em status (agora como enum)
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");

-- Conversion: index composto type+status
CREATE INDEX "conversions_type_status_idx" ON "conversions"("type", "status");

-- =====================================================
-- Novas Foreign Keys (integridade referencial)
-- =====================================================

-- AffiliateCommission -> Customer (RESTRICT: não deletar customer com comissões)
ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AffiliateCommission -> Transaction (SET NULL: se transação for deletada, mantém comissão)
ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Conversion -> Affiliate (SET NULL: se afiliado for removido, mantém conversão)
ALTER TABLE "conversions"
  ADD CONSTRAINT "conversions_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
