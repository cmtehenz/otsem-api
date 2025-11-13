import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterBankingService } from '../inter/services/inter-banking.service';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interBanking: InterBankingService, // voltou
  ) { }

  /**
   * 📊 Dashboard completo com todos os dados
   */
  async getStats() {
    this.logger.log('📊 Obtendo estatísticas completas...');

    try {
      const [
        totalCustomers,
        totalDeposits,
        totalPayouts,
        pendingDeposits,
      ] = await Promise.all([
        this.prisma.customer.count(),
        this.prisma.deposit.count(),
        this.prisma.payout.count(),
        this.safePendingDeposits(),
      ]);

      const [depositSum, payoutSum, banking] = await Promise.all([
        this.safeDepositSumConfirmed(),
        this.safePayoutSumCompleted(),
        this.interBanking.getDashboardData().catch(() => null),
      ]);

      return {
        customers: { total: totalCustomers },
        deposits: {
          total: totalDeposits,
          pending: pendingDeposits,
          confirmed: totalDeposits - pendingDeposits,
          totalValue: this.toReais(depositSum._sum.receiptValue),
        },
        payouts: {
          total: totalPayouts,
          totalValue: this.toNumber(payoutSum._sum.amount),
        },
        banking,
        timestamp: new Date().toISOString(),
      };
    } catch (e: any) {
      this.logger.error('❌ Erro ao obter stats:', e.message);
      throw e;
    }
  }

  /**
   * 📈 Resumo de customers e transações
   */
  async getSummary() {
    this.logger.log('📈 Obtendo resumo...');

    try {
      const [totalCustomers, totalDeposits, totalPayouts] =
        await Promise.all([
          this.prisma.customer.count(),
          this.prisma.deposit.count(),
          this.prisma.payout.count(),
        ]);

      return {
        customers: totalCustomers,
        deposits: totalDeposits,
        payouts: totalPayouts,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('❌ Erro ao obter resumo:', error.message);
      throw error;
    }
  }

  async getInterBalance() {
    this.logger.log('💰 Consultando saldo Inter...');
    try {
      const saldo = await this.interBanking.getSaldo();
      return { saldo, timestamp: new Date().toISOString() };
    } catch (e: any) {
      this.logger.error('❌ Erro saldo Inter:', e.message);
      return { error: e.message, saldo: null, timestamp: new Date().toISOString() };
    }
  }

  /**
   * 👥 Últimos 10 customers cadastrados
   */
  async getLatestUsers() {
    this.logger.log('👥 Buscando últimos customers...');

    try {
      const users = await this.prisma.customer.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, cpf: true, createdAt: true },
      });

      return { users, total: users.length, timestamp: new Date().toISOString() };
    } catch (error: any) {
      this.logger.error('❌ Erro ao buscar customers:', error.message);
      throw error;
    }
  }

  /**
   * 💸 Últimas 10 transações (depósitos e saques)
   */
  async getLatestTransactions() {
    this.logger.log('💸 Buscando últimas transações...');

    try {
      const [deposits, payouts] = await Promise.all([
        this.prisma.deposit.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            endToEnd: true,
            receiptValue: true,
            status: true,
            payerName: true,
            createdAt: true,
          },
        }),
        this.prisma.payout.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            status: true,
            pixKey: true,
            beneficiaryName: true,
            createdAt: true,
          },
        }),
      ]);

      const transactions = [
        ...deposits.map(d => ({
          id: d.id,
          type: 'DEPOSIT' as const,
          value: this.toReais(d.receiptValue),
          status: d.status,
          customerName: d.payerName,
          reference: d.endToEnd,
          createdAt: d.createdAt,
        })),
        ...payouts.map(p => ({
          id: p.id,
          type: 'PAYOUT' as const,
          value: this.toNumber(p.amount),
          status: p.status,
          customerName: p.beneficiaryName,
          reference: p.pixKey,
          createdAt: p.createdAt,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        transactions: transactions.slice(0, 10),
        total: transactions.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('❌ Erro ao buscar transações:', error.message);
      throw error;
    }
  }

  // Helpers (tolerantes até enum ser criado no banco)
  private async safePendingDeposits() {
    return this.prisma.deposit.count({ where: { status: 'PENDING' } }).catch(() => 0);
  }
  private async safeDepositSumConfirmed() {
    return this.prisma.deposit.aggregate({
      _sum: { receiptValue: true },
      where: { status: 'CONFIRMED' },
    }).catch(() => ({ _sum: { receiptValue: 0 } }));
  }
  private async safePayoutSumCompleted() {
    return this.prisma.payout.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED' },
    }).catch(() => ({ _sum: { amount: 0 } }));
  }
  private toReais(intOrNull: number | null | undefined) {
    return Number(intOrNull || 0) / 100;
  }
  private toNumber(decOrNull: any) {
    return decOrNull ? Number(decOrNull) : 0;
  }
}
