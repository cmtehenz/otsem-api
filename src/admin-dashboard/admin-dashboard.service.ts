import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterBankingService } from '../inter/services/inter-banking.service';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interBanking: InterBankingService,
  ) { }

  async getStats() {
    this.logger.log('Obtendo estatisticas completas...');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Days = new Date(startOfToday);
    last7Days.setDate(last7Days.getDate() - 6);
    const last30Days = new Date(startOfToday);
    last30Days.setDate(last30Days.getDate() - 29);

    try {
      const [
        totalUsers,
        usersToday,
        usersThisWeek,
        usersThisMonth,
        kycPending,
        kycApproved,
        kycRejected,
        totalTransactions,
        transactionsToday,
        volumeTodayAgg,
        volumeWeekAgg,
        volumeMonthAgg,
        conversionsTodayData,
        conversionsVolumeAgg,
        transactionsByTypeRaw,
        recentTxRaw,
        banking,
        accountsBalance,
      ] = await Promise.all([
        this.prisma.customer.count(),
        this.prisma.customer.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.customer.count({ where: { createdAt: { gte: startOfWeek } } }),
        this.prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
        this.prisma.customer.count({ where: { accountStatus: { in: ['requested', 'in_review'] } } }),
        this.prisma.customer.count({ where: { accountStatus: 'approved' } }),
        this.prisma.customer.count({ where: { accountStatus: 'rejected' } }),
        this.prisma.transaction.count(),
        this.prisma.transaction.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: startOfToday }, status: 'COMPLETED' },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: startOfWeek }, status: 'COMPLETED' },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
        }),
        this.prisma.transaction.count({
          where: { type: 'CONVERSION', createdAt: { gte: startOfToday } },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: 'CONVERSION', createdAt: { gte: startOfToday }, status: 'COMPLETED' },
        }),
        this.prisma.transaction.groupBy({
          by: ['type'],
          _count: true,
          _sum: { amount: true },
          where: { status: 'COMPLETED' },
        }),
        this.prisma.transaction.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            account: {
              include: { customer: { select: { name: true } } },
            },
          },
        }),
        this.interBanking.getDashboardData().catch(() => null),
        this.prisma.account.aggregate({
          _sum: { balance: true, blockedAmount: true },
        }),
      ]);

      const transactionsLast7Days = await this.getTransactionsLast7Days(last7Days);
      const usersLast30Days = await this.getUsersLast30Days(last30Days);

      const transactionsByType = transactionsByTypeRaw.map((t: any) => ({
        type: t.type,
        count: t._count,
        volume: this.toNumber(t._sum?.amount),
      }));

      const recentTransactions = recentTxRaw.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: this.toNumber(tx.amount),
        currency: 'BRL',
        status: tx.status,
        description: tx.description || this.getDefaultDescription(tx.type),
        customerName: tx.account?.customer?.name || 'N/A',
        createdAt: tx.createdAt,
      }));

      const alerts = await this.generateAlerts(kycPending);

      const totalBrlBalance = this.toNumber(accountsBalance._sum?.balance);
      const blockedBrl = this.toNumber(accountsBalance._sum?.blockedAmount);

      return {
        kpis: {
          totalUsers,
          usersToday,
          usersThisWeek,
          usersThisMonth,
          kycPending,
          kycApproved,
          kycRejected,
          totalTransactions,
          transactionsToday,
          volumeToday: this.toNumber(volumeTodayAgg._sum?.amount),
          volumeThisWeek: this.toNumber(volumeWeekAgg._sum?.amount),
          volumeThisMonth: this.toNumber(volumeMonthAgg._sum?.amount),
          conversionsToday: conversionsTodayData,
          conversionsVolume: this.toNumber(conversionsVolumeAgg._sum?.amount),
        },
        balances: {
          brl: {
            available: totalBrlBalance - blockedBrl,
            blocked: blockedBrl,
            total: totalBrlBalance,
          },
          usdt: {
            solana: 0,
            tron: 0,
            total: 0,
          },
          usdtRate: 6.10,
          inter: banking,
        },
        charts: {
          transactionsLast7Days,
          usersLast30Days,
          transactionsByType,
        },
        recentTransactions,
        alerts,
        timestamp: new Date().toISOString(),
      };
    } catch (e: any) {
      this.logger.error('Erro ao obter stats:', e.message);
      throw e;
    }
  }

  private async getTransactionsLast7Days(startDate: Date) {
    const results: { date: string; count: number; volume: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [count, volume] = await Promise.all([
        this.prisma.transaction.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: dayStart, lt: dayEnd }, status: 'COMPLETED' },
        }),
      ]);

      results.push({
        date: dayStart.toISOString().split('T')[0],
        count,
        volume: this.toNumber(volume._sum?.amount),
      });
    }

    return results;
  }

  private async getUsersLast30Days(startDate: Date) {
    const results: { date: string; count: number }[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await this.prisma.customer.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });

      results.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    return results;
  }

  private async generateAlerts(kycPending: number) {
    const alerts: any[] = [];

    if (kycPending > 0) {
      alerts.push({
        id: `alert_kyc_${Date.now()}`,
        type: 'kyc_pending',
        title: `${kycPending} verificações KYC pendentes`,
        description: `Existem ${kycPending} usuários aguardando aprovação de documentos`,
        actionUrl: '/admin/kyc',
        createdAt: new Date().toISOString(),
      });
    }

    const highValueTx = await this.prisma.transaction.findFirst({
      where: {
        status: 'PENDING',
        amount: { gte: 10000 },
      },
      orderBy: { createdAt: 'desc' },
      include: { account: { include: { customer: { select: { name: true } } } } },
    });

    if (highValueTx) {
      alerts.push({
        id: `alert_high_${highValueTx.id}`,
        type: 'high_value',
        title: 'Transação de alto valor',
        description: `Transação de R$ ${this.toNumber(highValueTx.amount).toLocaleString('pt-BR')} aguardando revisão`,
        actionUrl: `/admin/transactions/${highValueTx.id}`,
        createdAt: highValueTx.createdAt.toISOString(),
      });
    }

    return alerts;
  }

  private getDefaultDescription(type: string) {
    const descriptions: Record<string, string> = {
      PIX_IN: 'Depósito via PIX',
      PIX_OUT: 'Saque via PIX',
      CONVERSION: 'Conversão BRL → USDT',
      TRANSFER: 'Transferência',
      PAYOUT: 'Pagamento USDT',
    };
    return descriptions[type] || type;
  }

  async getSummary() {
    this.logger.log('Obtendo resumo...');

    try {
      const [totalCustomers, totalTransactions] = await Promise.all([
        this.prisma.customer.count(),
        this.prisma.transaction.count(),
      ]);

      return {
        customers: totalCustomers,
        transactions: totalTransactions,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Erro ao obter resumo:', error.message);
      throw error;
    }
  }

  async getInterBalance() {
    this.logger.log('Consultando saldo Inter...');
    try {
      const saldo = await this.interBanking.getSaldo();
      return { saldo, timestamp: new Date().toISOString() };
    } catch (e: any) {
      this.logger.error('Erro saldo Inter:', e.message);
      return { error: e.message, saldo: null, timestamp: new Date().toISOString() };
    }
  }

  async getLatestUsers() {
    this.logger.log('Buscando ultimos customers...');

    try {
      const users = await this.prisma.customer.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, cpf: true, createdAt: true },
      });

      return { users, total: users.length, timestamp: new Date().toISOString() };
    } catch (error: any) {
      this.logger.error('Erro ao buscar customers:', error.message);
      throw error;
    }
  }

  async getLatestTransactions() {
    this.logger.log('Buscando ultimas transacoes...');

    try {
      const transactions = await this.prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          payerName: true,
          receiverName: true,
          endToEnd: true,
          txid: true,
          description: true,
          createdAt: true,
          completedAt: true,
        },
      });

      return {
        transactions: transactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          status: tx.status,
          value: this.toNumber(tx.amount),
          customerName: tx.type === 'PIX_IN' ? tx.payerName : tx.receiverName,
          reference: tx.endToEnd || tx.txid,
          description: tx.description,
          createdAt: tx.createdAt,
          completedAt: tx.completedAt,
        })),
        total: transactions.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Erro ao buscar transacoes:', error.message);
      throw error;
    }
  }

  private toNumber(decOrNull: any) {
    return decOrNull ? Number(decOrNull) : 0;
  }

  async getSpreadReport() {
    this.logger.log('Gerando relatório de spread...');

    try {
      const conversions = await this.prisma.transaction.findMany({
        where: { type: 'CONVERSION' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          description: true,
          externalData: true,
          createdAt: true,
          account: {
            select: {
              customer: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      let totalChargedBrl = 0;
      let totalExchangedBrl = 0;
      let totalSpreadBrl = 0;
      let totalUsdtBought = 0;

      const details = conversions.map(tx => {
        const data = tx.externalData as any;
        const spread = data?.spread || {};
        const chargedBrl = spread.chargedBrl || this.toNumber(tx.amount);
        const exchangedBrl = spread.exchangedBrl || chargedBrl;
        const spreadBrl = spread.spreadBrl || 0;
        const usdtAmount = data?.usdtAmount || 0;

        totalChargedBrl += chargedBrl;
        totalExchangedBrl += exchangedBrl;
        totalSpreadBrl += spreadBrl;
        totalUsdtBought += usdtAmount;

        return {
          id: tx.id,
          customer: tx.account?.customer?.name || 'N/A',
          customerId: tx.account?.customer?.id,
          chargedBrl,
          exchangedBrl,
          spreadBrl,
          spreadPercent: chargedBrl > 0 ? ((spreadBrl / chargedBrl) * 100).toFixed(2) + '%' : '0%',
          usdtBought: usdtAmount,
          walletAddress: data?.walletAddress || null,
          network: data?.network || null,
          createdAt: tx.createdAt,
        };
      });

      return {
        summary: {
          totalConversions: conversions.length,
          totalChargedBrl: totalChargedBrl.toFixed(2),
          totalExchangedBrl: totalExchangedBrl.toFixed(2),
          totalSpreadBrl: totalSpreadBrl.toFixed(2),
          totalUsdtBought: totalUsdtBought.toFixed(2),
          averageSpreadPercent: totalChargedBrl > 0 
            ? ((totalSpreadBrl / totalChargedBrl) * 100).toFixed(2) + '%' 
            : '0%',
        },
        conversions: details,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Erro ao gerar relatório de spread:', error.message);
      throw error;
    }
  }
}
