-- CreateTable
CREATE TABLE "inter_webhook_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "txid" TEXT,
    "payload" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inter_webhook_logs_pkey" PRIMARY KEY ("id")
);
