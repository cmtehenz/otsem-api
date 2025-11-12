// src/statements/statements.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { StatementQueryDto } from './dto/statement-query.dto';

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(private readonly prisma: PrismaService) { }

  private async resolveAccountByAccountHolderId(accountHolderId: string) {
    // accountHolderId == externalClientId do customer
    const customer = await this.prisma.customer.findFirst({
      where: { externalClientId: accountHolderId },
      select: { id: true },
    });

    if (!customer) throw new BadRequestException('Cliente não encontrado');

    const account = await this.prisma.account.findUnique({
      where: { customerId: customer.id },
    });

    if (!account) throw new BadRequestException('Conta não encontrada');

    return account;
  }

  private isCredit(type: string): boolean {
    // Ajuste conforme os tipos válidos no seu enum
    return ['PIX_IN', 'TRANSFER_IN', 'ADJUST_CREDIT', 'DEPOSIT_IN'].includes(type);
  }

  /**
   * Usado por: GET /statements/account-holders/:accountHolderId/balance
   */
  async getBalance(accountHolderId: string) {
    const account = await this.resolveAccountByAccountHolderId(accountHolderId);

    const balance = new Prisma.Decimal(account.balance || 0);
    const blocked = new Prisma.Decimal(account.blockedAmount || 0);
    const available = balance.sub(blocked);

    return {
      accountId: account.id,
      balance: Number(balance),
      blockedAmount: Number(blocked),
      availableBalance: Number(available),
      status: account.status,
      pixKey: account.pixKey ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Usado por: GET /statements/account-holders/:accountHolderId
   */
  async getStatement(
    accountHolderId: string,
    page = 1,
    limit = 50,
    startDate?: string,
    endDate?: string,
  ) {
    const account = await this.resolveAccountByAccountHolderId(accountHolderId);

    const now = new Date();
    const from = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = endDate ? new Date(endDate) : now;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    // Saldo de abertura: saldo após a última transação ANTES do período
    const lastBefore = await this.prisma.transaction.findFirst({
      where: { accountId: account.id, createdAt: { lt: from } },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const openingBalance = lastBefore?.balanceAfter ?? new Prisma.Decimal(0);

    // Total de transações no período (para paginação)
    const total = await this.prisma.transaction.count({
      where: {
        accountId: account.id,
        createdAt: { gte: from, lte: to },
      },
    });

    const skip = Math.max(0, (page - 1) * limit);

    // Transações no período (paginadas)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: account.id,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'asc' }, // extrato cronológico
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
        amount: true,
        description: true,
        balanceBefore: true,
        balanceAfter: true,
        externalId: true,
        metadata: true,
      },
    });

    // Totais (do recorte retornado)
    let totalCredits = new Prisma.Decimal(0);
    let totalDebits = new Prisma.Decimal(0);
    for (const t of transactions) {
      if (this.isCredit(t.type)) totalCredits = totalCredits.add(t.amount);
      else totalDebits = totalDebits.add(t.amount);
    }

    const closingBalance =
      transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : openingBalance;

    const items = transactions.map((t) => ({
      id: t.id,
      date: t.createdAt,
      type: t.type,
      status: t.status,
      description: t.description,
      amount: Number(t.amount),
      direction: this.isCredit(t.type) ? 'C' : 'D',
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      externalId: t.externalId,
      metadata: t.metadata ?? null,
    }));

    return {
      accountId: account.id,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      pagination: {
        page,
        limit,
        total,
        returned: items.length,
      },
      openingBalance: Number(openingBalance),
      totalCredits: Number(totalCredits),
      totalDebits: Number(totalDebits),
      closingBalance: Number(closingBalance),
      items,
    };
  }

  // Admin: ver extrato por customerId
  async getStatementByCustomerIdAdmin(customerId: string, query: StatementQueryDto) {
    return this.getCustomerStatement(customerId, query);
  }

  async getCustomerStatement(customerId: string, query: StatementQueryDto) {
    // Busca a account do customer
    const account = await this.prisma.account.findUnique({
      where: { customerId },
      select: { id: true, balance: true },
    });
    if (!account) throw new BadRequestException('Conta não encontrada');

    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    const limit = query.limit ?? 200;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    // Saldo de abertura
    const lastBefore = await this.prisma.transaction.findFirst({
      where: { accountId: account.id, createdAt: { lt: from } },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const openingBalance = lastBefore?.balanceAfter ?? new Prisma.Decimal(0);

    // Transações do período
    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: account.id,
        createdAt: { gte: from, lte: to },
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
        amount: true,
        description: true,
        balanceBefore: true,
        balanceAfter: true,
        externalId: true,
        metadata: true,
      },
    });

    // Totais
    let totalCredits = new Prisma.Decimal(0);
    let totalDebits = new Prisma.Decimal(0);
    for (const t of transactions) {
      if (this.isCredit(t.type)) totalCredits = totalCredits.add(t.amount);
      else totalDebits = totalDebits.add(t.amount);
    }

    const closingBalance =
      transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : openingBalance;

    const items = transactions.map((t) => ({
      id: t.id,
      date: t.createdAt,
      type: t.type,
      status: t.status,
      description: t.description,
      amount: Number(t.amount),
      direction: this.isCredit(t.type) ? 'C' : 'D',
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      externalId: t.externalId,
      metadata: t.metadata ?? null,
    }));

    return {
      accountId: account.id,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      openingBalance: Number(openingBalance),
      totalCredits: Number(totalCredits),
      totalDebits: Number(totalDebits),
      closingBalance: Number(closingBalance),
      count: items.length,
      items,
    };
  }
}
