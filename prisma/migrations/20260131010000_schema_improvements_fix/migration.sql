-- =====================================================
-- Fix: aplica os statements que não rodaram porque a
-- migration anterior falhou no CREATE INDEX duplicado.
-- Todos os comandos são idempotentes (IF NOT EXISTS).
-- =====================================================

-- Índices que já existiam (recriados pelo ALTER COLUMN TYPE)
-- kyc_upgrade_requests_status_idx  -> já existe
-- AffiliateCommission_status_idx   -> já existe

-- Novos índices compostos
CREATE INDEX IF NOT EXISTS "Wallet_customerId_isMain_idx"
  ON "Wallet"("customerId", "isMain");

CREATE INDEX IF NOT EXISTS "transactions_accountId_type_status_idx"
  ON "transactions"("accountId", "type", "status");

CREATE INDEX IF NOT EXISTS "conversions_type_status_idx"
  ON "conversions"("type", "status");

-- Novas Foreign Keys
-- Usa DO block para ignorar se já existir

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission"
    ADD CONSTRAINT "AffiliateCommission_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission"
    ADD CONSTRAINT "AffiliateCommission_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "conversions"
    ADD CONSTRAINT "conversions_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
