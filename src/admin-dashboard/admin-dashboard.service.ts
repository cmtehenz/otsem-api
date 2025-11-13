import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterBankingService } from '../inter/services/inter-banking.service';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interBankingService: InterBankingService,
  ) { }

  async getSummary() {
    const [
      totalCustomers,
      pendingCustomers,
      approvedCustomers,
      rejectedCustomers,
      totalTransactions,
      totalVolume,
    ] = await Promise.all([
      // Total de customers
      this.prisma.customer.count(),

      // Customers pendentes (accountStatus = requested)
      this.prisma.customer.count({
        where: { accountStatus: AccountStatus.requested }
      }),

      // Customers aprovados (accountStatus = approved)
      this.prisma.customer.count({
        where: { accountStatus: AccountStatus.approved }
      }),

      // Customers rejeitados (accountStatus = rejected)
      this.prisma.customer.count({
        where: { accountStatus: AccountStatus.rejected }
      }),

      // Total de transações
      this.prisma.transaction.count(),

      // Volume total transacionado
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
      }),
    ]);

    return {
      customers: {
        total: totalCustomers,
        pending: pendingCustomers,
        approved: approvedCustomers,
        rejected: rejectedCustomers,
      },
      transactions: {
        total: totalTransactions,
        volume: Number(totalVolume._sum.amount || 0),
      },
    };
  }

  async getLatestUsers() {
    const users = await this.prisma.customer.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        accountStatus: true, // ← Campo correto
        createdAt: true,
      },
    });

    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.accountStatus, // ← Mapear para 'status' no response
      createdAt: user.createdAt,
    }));
  }

  async getLatestTransactions() {
    const transactions = await this.prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        account: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.createdAt,
      customer: {
        id: t.account.customer.id,
        name: t.account.customer.name,
      },
    }));
  }

  /**
   * Obter saldos detalhados da conta Inter
   */
  async getInterBalance() {
    try {
      const saldo = await this.interBankingService.getSaldo();

      return {
        disponivel: Number(saldo.disponivel || 0),
        bloqueadoCheque: Number(saldo.bloqueadoCheque || 0),
        bloqueadoJudicialmente: Number(saldo.bloqueadoJudicialmente || 0),
        bloqueadoAdministrativo: Number(saldo.bloqueadoAdministrativo || 0),
        limite: Number(saldo.limite || 0),
        total: Number(saldo.disponivel || 0) +
          Number(saldo.bloqueadoCheque || 0) +
          Number(saldo.bloqueadoJudicialmente || 0) +
          Number(saldo.bloqueadoAdministrativo || 0),
      };
    } catch (error) {
      this.logger.error('❌ Erro ao buscar saldo Inter:', error.message);
      return {
        disponivel: 0,
        bloqueadoCheque: 0,
        bloqueadoJudicialmente: 0,
        bloqueadoAdministrativo: 0,
        limite: 0,
        total: 0,
        error: error.message,
      };
    }
  }

  /**
   * Dashboard completo com todos os dados
   */
  async getStats() {
    const [summary, interBalance, latestUsers, latestTransactions] = await Promise.all([
      this.getSummary(),
      this.getInterBalance(),
      this.getLatestUsers(),
      this.getLatestTransactions(),
    ]);

    return {
      summary,
      interBalance,
      latestUsers,
      latestTransactions,
    };
  }
}
