import { PrismaClient, ConversionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateConversions() {
  console.log('🔄 Iniciando migração de conversões...\n');

  const transactions = await prisma.transaction.findMany({
    where: { type: 'CONVERSION' },
    include: {
      account: {
        include: { customer: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Encontradas ${transactions.length} transações de conversão\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const tx of transactions) {
    const existing = await prisma.conversion.findFirst({
      where: { transactionId: tx.id },
    });

    if (existing) {
      console.log(`⏭️ Já migrada: ${tx.id}`);
      skipped++;
      continue;
    }

    const data = tx.externalData as any;
    if (!data) {
      console.log(`⚠️ Sem dados externos: ${tx.id}`);
      skipped++;
      continue;
    }

    try {
      const conversion = await prisma.conversion.create({
        data: {
          customerId: tx.account.customerId,
          accountId: tx.accountId,
          transactionId: tx.id,
          brlCharged: data.brlCharged || tx.amount,
          brlExchanged: data.brlExchanged || tx.amount,
          spreadPercent: data.spreadPercent || 0.95,
          spreadBrl: data.spreadBrl || 0,
          usdtPurchased: data.usdtPurchased || data.usdt || 0,
          usdtWithdrawn: data.usdtWithdrawn || data.usdt || 0,
          exchangeRate: data.exchangeRate || data.rate || 0,
          network: data.network || 'SOLANA',
          walletAddress: data.walletAddress || data.toAddress || '',
          walletId: data.walletId || null,
          pixEndToEnd: data.pixEndToEnd || null,
          pixTxid: data.pixTxid || null,
          okxOrderId: data.okxOrderId || data.orderId || null,
          okxWithdrawId: data.okxWithdrawId || data.withdrawId || null,
          affiliateId: data.affiliateId || null,
          affiliateCommission: data.affiliateCommission || 0,
          okxWithdrawFee: data.okxWithdrawFee || data.withdrawFee || 0,
          okxTradingFee: data.okxTradingFee || 0,
          totalOkxFees: data.totalOkxFees || 0,
          grossProfit: data.grossProfit || data.spreadBrl || 0,
          netProfit: data.netProfit || 0,
          status: tx.status === 'COMPLETED' ? ConversionStatus.COMPLETED : 
                  tx.status === 'FAILED' ? ConversionStatus.FAILED : 
                  ConversionStatus.PENDING,
          createdAt: tx.createdAt,
          completedAt: tx.completedAt,
        },
      });

      console.log(`✅ Migrada: ${tx.id} → ${conversion.id}`);
      migrated++;
    } catch (err) {
      console.error(`❌ Erro ao migrar ${tx.id}:`, err);
      errors++;
    }
  }

  console.log('\n📊 Resumo da migração:');
  console.log(`  ✅ Migradas: ${migrated}`);
  console.log(`  ⏭️ Ignoradas: ${skipped}`);
  console.log(`  ❌ Erros: ${errors}`);
}

migrateConversions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
