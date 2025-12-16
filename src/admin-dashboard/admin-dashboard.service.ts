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

  /**
   * Dashboard completo com todos os dados
   */
  async getStats() {
    this.logger.log('Obtendo estatisticas completas...');

    try {
      const [
        totalCustomers,
        totalPixIn,
        totalPixOut,
        pendingTx,
      ] = await Promise.all([
        this.prisma.customer.count(),
        this.prisma.transaction.count({ where: { type: 'PIX_IN' } }),
        this.prisma.transaction.count({ where: { type: 'PIX_OUT' } }),
        this.prisma.transaction.count({ where: { status: 'PENDING' } }),
      ]);

      const [pixInSum, pixOutSum, banking] = await Promise.all([
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: 'PIX_IN', status: 'COMPLETED' },
        }).catch(() => ({ _sum: { amount: null } })),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: 'PIX_OUT', status: 'COMPLETED' },
        }).catch(() => ({ _sum: { amount: null } })),
        this.interBanking.getDashboardData().catch(() => null),
      ]);

      return {
        customers: { total: totalCustomers },
        transactions: {
          pixIn: {
            total: totalPixIn,
            totalValue: this.toNumber(pixInSum._sum.amount),
          },
          pixOut: {
            total: totalPixOut,
            totalValue: this.toNumber(pixOutSum._sum.amount),
          },
          pending: pendingTx,
        },
        banking,
        timestamp: new Date().toISOString(),
      };
    } catch (e: any) {
      this.logger.error('Erro ao obter stats:', e.message);
      throw e;
    }
  }

  /**
   * Resumo de customers e transacoes
   */
  async getSummary() {
    this.logger.log('Obtendo resumo...');

    try {
      const [totalCustomers, totalTransactions] =
        await Promise.all([
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

  /**
   * Ultimos 10 customers cadastrados
   */
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

  /**
   * Ultimas 10 transacoes (PIX_IN e PIX_OUT)
   */
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
}
