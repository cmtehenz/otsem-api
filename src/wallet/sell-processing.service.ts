import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OkxService } from '../okx/services/okx.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SellProcessingService {
  private readonly logger = new Logger(SellProcessingService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly okxService: OkxService,
    private readonly interPixService: InterPixService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processOkxDeposits() {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    try {
      await this.checkAndProcessSellConversions();
      await this.detectOrphanDeposits();
    } catch (error: any) {
      this.logger.error(`[SELL-POLLING] Erro no processamento: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async detectOrphanDeposits() {
    const deposits = await this.okxService.getRecentDeposits();
    const processedDepIds = await this.prisma.conversion.findMany({
      where: { okxDepositId: { not: null } },
      select: { okxDepositId: true },
    });
    
    const processedSet = new Set(processedDepIds.map(c => c.okxDepositId));
    
    const orphanDeposits = deposits.filter((dep: any) => {
      if (dep.state !== '2') return false;
      if (processedSet.has(dep.depId)) return false;
      const depTime = new Date(parseInt(dep.ts));
      const now = new Date();
      const hoursDiff = (now.getTime() - depTime.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 24;
    });
    
    if (orphanDeposits.length > 0) {
      this.logger.warn(`[SELL-POLLING] ⚠️ Detectados ${orphanDeposits.length} depósitos não processados:`);
      for (const dep of orphanDeposits) {
        this.logger.warn(`  - ${dep.amt} USDT (${dep.chain}) - depId: ${dep.depId}, txId: ${dep.txId}`);
      }
    }
  }

  async checkAndProcessSellConversions() {
    const pendingConversions = await this.prisma.conversion.findMany({
      where: {
        type: 'SELL',
        status: { in: ['PENDING', 'USDT_RECEIVED', 'USDT_SOLD'] },
      },
      include: {
        customer: true,
        account: true,
      },
    });

    if (pendingConversions.length === 0) {
      return;
    }

    this.logger.log(`[SELL-POLLING] Encontradas ${pendingConversions.length} conversões pendentes`);

    const deposits = await this.okxService.getRecentDeposits();
    
    for (const conversion of pendingConversions) {
      try {
        await this.processConversion(conversion, deposits);
      } catch (error: any) {
        this.logger.error(`[SELL] Erro ao processar conversão ${conversion.id}: ${error.message}`);
        await this.prisma.conversion.update({
          where: { id: conversion.id },
          data: {
            errorMessage: error.message,
          },
        });
      }
    }
  }

  private async processConversion(conversion: any, deposits: any[]) {
    const status = conversion.status;
    
    if (status === 'PENDING') {
      await this.checkDepositConfirmation(conversion, deposits);
    } else if (status === 'USDT_RECEIVED') {
      await this.sellUsdtForBrl(conversion);
    } else if (status === 'USDT_SOLD') {
      await this.creditBalanceToCustomer(conversion);
    }
  }

  private async checkDepositConfirmation(conversion: any, deposits: any[]) {
    const matchingDeposit = deposits.find((dep: any) => {
      if (conversion.txHash && dep.txId === conversion.txHash) {
        return true;
      }
      
      const chain = conversion.network === 'SOLANA' ? 'USDT-Solana' : 'USDT-TRC20';
      if (dep.chain === chain && dep.state === '2') {
        const usdtAmount = parseFloat(conversion.usdtPurchased.toString());
        const depAmount = parseFloat(dep.amt);
        if (Math.abs(usdtAmount - depAmount) < 0.01) {
          const depTime = new Date(parseInt(dep.ts));
          const convTime = new Date(conversion.createdAt);
          const diffMinutes = (depTime.getTime() - convTime.getTime()) / (1000 * 60);
          if (diffMinutes >= -5 && diffMinutes <= 60) {
            return true;
          }
        }
      }
      return false;
    });

    if (matchingDeposit) {
      this.logger.log(`[SELL] Depósito confirmado para conversão ${conversion.id}: ${matchingDeposit.amt} USDT`);
      
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          status: 'USDT_RECEIVED',
          okxDepositId: matchingDeposit.depId,
          txHash: matchingDeposit.txId,
          usdtPurchased: new Decimal(matchingDeposit.amt),
        },
      });
    }
  }

  private async sellUsdtForBrl(conversion: any) {
    this.logger.log(`[SELL] Vendendo ${conversion.usdtPurchased} USDT por BRL...`);
    
    const usdtAmount = parseFloat(conversion.usdtPurchased.toString());
    const sellResult = await this.okxService.sellUsdtForBrl(usdtAmount);
    
    const spreadPercent = parseFloat(conversion.spreadPercent.toString());
    const spreadBrl = sellResult.brlReceived * spreadPercent;
    const brlToCustomer = sellResult.brlReceived - spreadBrl;
    
    await this.prisma.conversion.update({
      where: { id: conversion.id },
      data: {
        status: 'USDT_SOLD',
        okxOrderId: sellResult.orderId,
        brlExchanged: new Decimal(sellResult.brlReceived),
        okxTradingFee: new Decimal(sellResult.tradingFee),
        spreadBrl: new Decimal(spreadBrl),
        grossProfit: new Decimal(spreadBrl),
        netProfit: new Decimal(spreadBrl - sellResult.tradingFee),
        exchangeRate: new Decimal(sellResult.brlReceived / usdtAmount),
      },
    });

    this.logger.log(`[SELL] USDT vendido: R$ ${sellResult.brlReceived.toFixed(2)} (spread: R$ ${spreadBrl.toFixed(2)})`);
  }

  private async creditBalanceToCustomer(conversion: any) {
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: {
        accountId: conversion.accountId,
        type: 'CONVERSION',
        subType: 'SELL',
        externalId: conversion.id,
      },
    });
    
    if (existingTransaction) {
      this.logger.log(`[SELL] Transação já existe para conversão ${conversion.id}, apenas atualizando status`);
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return;
    }
    
    const usdtAmount = parseFloat(conversion.usdtPurchased.toString());
    const spreadPercent = parseFloat(conversion.spreadPercent.toString());
    const brlExchanged = parseFloat(conversion.brlExchanged.toString());
    const okxTradingFee = parseFloat(conversion.okxTradingFee?.toString() || '0');
    const exchangeRate = parseFloat(conversion.exchangeRate?.toString() || (brlExchanged / usdtAmount).toString());
    
    const spreadBrl = brlExchanged * spreadPercent;
    const totalFees = spreadBrl + okxTradingFee;
    const brlToCustomer = brlExchanged - totalFees;
    
    const grossProfit = spreadBrl;
    const netProfit = spreadBrl - okxTradingFee;
    
    const balanceBefore = parseFloat(conversion.account.balance.toString());
    const balanceAfter = balanceBefore + brlToCustomer;
    
    this.logger.log(`[SELL] Creditando R$ ${brlToCustomer.toFixed(2)} no saldo OTSEM`);
    this.logger.log(`[SELL] Detalhes: USDT=${usdtAmount}, BRL bruto=${brlExchanged.toFixed(2)}, spread=${spreadBrl.toFixed(2)}, taxaOKX=${okxTradingFee.toFixed(2)}, líquido=${brlToCustomer.toFixed(2)}`);
    this.logger.log(`[SELL] Saldo: R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)}`);
    
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: conversion.accountId },
        data: { balance: new Decimal(balanceAfter) },
      }),
      
      this.prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          status: 'COMPLETED',
          grossProfit: new Decimal(grossProfit),
          netProfit: new Decimal(netProfit),
          completedAt: new Date(),
        },
      }),
      
      this.prisma.transaction.create({
        data: {
          accountId: conversion.accountId,
          type: 'CONVERSION',
          subType: 'SELL',
          amount: new Decimal(brlToCustomer),
          balanceBefore: new Decimal(balanceBefore),
          balanceAfter: new Decimal(balanceAfter),
          description: `Venda de ${usdtAmount} USDT → R$ ${brlToCustomer.toFixed(2)} (crédito em conta)`,
          status: 'COMPLETED',
          externalId: conversion.id,
          externalData: {
            usdtAmount,
            brlExchanged,
            spreadPercent,
            spreadBrl,
            okxTradingFee,
            totalFees,
            brlToCustomer,
            exchangeRate,
            grossProfit,
            netProfit,
            network: conversion.network,
            txHash: conversion.txHash,
          },
        },
      }),
    ]);

    this.logger.log(`[SELL] ✅ Conversão ${conversion.id} concluída! Novo saldo: R$ ${balanceAfter.toFixed(2)}`);
  }

  async manualProcessConversion(conversionId: string) {
    const conversion = await this.prisma.conversion.findUnique({
      where: { id: conversionId },
      include: {
        customer: true,
        account: true,
      },
    });

    if (!conversion) {
      throw new Error('Conversão não encontrada');
    }

    const deposits = await this.okxService.getRecentDeposits();
    await this.processConversion(conversion, deposits);

    return this.prisma.conversion.findUnique({
      where: { id: conversionId },
    });
  }

  async creditSellManually(params: {
    customerId: string;
    accountId: string;
    usdtAmount: number;
    txHash: string;
    network: 'SOLANA' | 'TRON';
  }) {
    const { customerId, accountId, usdtAmount, txHash, network } = params;
    
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }
    
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      throw new Error('Conta não encontrada');
    }

    const rate = await this.okxService.getBrlToUsdtRate();
    const spreadPercent = 0.0095;
    const brlBruto = usdtAmount * rate;
    const spreadBrl = brlBruto * spreadPercent;
    const brlLiquido = brlBruto - spreadBrl;

    this.logger.log(`[SELL-MANUAL] Creditando R$ ${brlLiquido.toFixed(2)} para ${customer.name}`);

    const conversion = await this.prisma.conversion.create({
      data: {
        customerId,
        accountId,
        type: 'SELL',
        brlCharged: 0,
        brlExchanged: new Decimal(brlBruto),
        spreadPercent: new Decimal(spreadPercent),
        spreadBrl: new Decimal(spreadBrl),
        usdtPurchased: new Decimal(usdtAmount),
        usdtWithdrawn: 0,
        exchangeRate: new Decimal(rate),
        network,
        walletAddress: '',
        txHash,
        okxTradingFee: 0,
        okxWithdrawFee: 0,
        totalOkxFees: 0,
        grossProfit: new Decimal(spreadBrl),
        netProfit: new Decimal(spreadBrl),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const balanceBefore = parseFloat(account.balance.toString());
    const balanceAfter = balanceBefore + brlLiquido;

    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: accountId },
        data: { balance: new Decimal(balanceAfter) },
      }),
      
      this.prisma.transaction.create({
        data: {
          accountId,
          type: 'CONVERSION',
          subType: 'SELL',
          amount: new Decimal(brlLiquido),
          balanceBefore: new Decimal(balanceBefore),
          balanceAfter: new Decimal(balanceAfter),
          description: `Venda de ${usdtAmount} USDT → R$ ${brlLiquido.toFixed(2)} (crédito manual)`,
          status: 'COMPLETED',
          externalId: txHash,
          externalData: {
            usdtAmount,
            brlExchanged: brlBruto,
            spreadPercent,
            spreadBrl,
            okxTradingFee: 0,
            totalFees: spreadBrl,
            brlToCustomer: brlLiquido,
            exchangeRate: rate,
            grossProfit: spreadBrl,
            netProfit: spreadBrl,
            network,
            txHash,
            manual: true,
          },
        },
      }),
    ]);

    this.logger.log(`[SELL-MANUAL] ✅ Conversão ${conversion.id} creditada! Novo saldo: R$ ${balanceAfter.toFixed(2)}`);

    return {
      conversionId: conversion.id,
      brlCredited: brlLiquido,
      newBalance: balanceAfter,
    };
  }
}
