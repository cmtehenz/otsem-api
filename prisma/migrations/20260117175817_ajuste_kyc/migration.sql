-- CreateTable
CREATE TABLE "kyc_upgrade_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currentLevel" "KycLevel" NOT NULL,
    "targetLevel" "KycLevel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_upgrade_requests_customerId_idx" ON "kyc_upgrade_requests"("customerId");

-- CreateIndex
CREATE INDEX "kyc_upgrade_requests_status_idx" ON "kyc_upgrade_requests"("status");

-- AddForeignKey
ALTER TABLE "kyc_upgrade_requests" ADD CONSTRAINT "kyc_upgrade_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
