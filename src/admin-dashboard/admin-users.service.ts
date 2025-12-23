import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  kycStatus?: string;
  accountStatus?: string;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(params: ListUsersParams) {
    const { page, limit, search, kycStatus, accountStatus } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { cnpj: { contains: search } },
      ];
    }

    if (kycStatus) {
      const statusMap: Record<string, string[]> = {
        'APPROVED': ['approved'],
        'PENDING': ['requested', 'in_review'],
        'REJECTED': ['rejected'],
        'NOT_STARTED': ['not_requested'],
      };
      const mappedStatuses = statusMap[kycStatus];
      if (mappedStatuses) {
        where.accountStatus = { in: mappedStatuses };
      }
    }

    if (accountStatus) {
      if (accountStatus === 'ACTIVE') {
        where.accountStatus = 'approved';
      } else if (accountStatus === 'BLOCKED') {
        where.accountStatus = 'suspended';
      }
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: { select: { balance: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: customers.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        cpfCnpj: c.cpf || c.cnpj || '',
        phone: c.phone || '',
        role: 'CUSTOMER',
        kycStatus: this.mapKycStatus(c.accountStatus),
        accountStatus: this.mapAccountStatus(c.accountStatus),
        balanceBRL: c.account ? Number(c.account.balance) : 0,
        createdAt: c.createdAt,
        lastLoginAt: null,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async getUserDetails(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        account: { select: { balance: true } },
        address: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpf || customer.cnpj || '',
      phone: customer.phone || '',
      role: 'CUSTOMER',
      kycStatus: this.mapKycStatus(customer.accountStatus),
      accountStatus: this.mapAccountStatus(customer.accountStatus),
      balanceBRL: customer.account ? Number(customer.account.balance) : 0,
      address: customer.address ? {
        street: customer.address.street,
        number: customer.address.number,
        complement: customer.address.complement,
        neighborhood: customer.address.neighborhood,
        city: customer.address.city,
        state: customer.address.state,
        zipCode: customer.address.zipCode,
      } : null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      lastLoginAt: null,
      kycDetails: {
        submittedAt: customer.accountStatus !== 'not_requested' ? customer.updatedAt : null,
        reviewedAt: ['approved', 'rejected'].includes(customer.accountStatus) ? customer.updatedAt : null,
        reviewedBy: null,
        rejectReason: null,
        documentType: null,
      },
    };
  }

  async getUserTransactions(customerId: string, limit: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { account: { select: { id: true } } },
    });

    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!customer.account) {
      return { data: [], total: 0, page: 1, limit };
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { accountId: customer.account.id },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.count({
        where: { accountId: customer.account.id },
      }),
    ]);

    return {
      data: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        description: tx.description || this.getDefaultDescription(tx.type),
        createdAt: tx.createdAt,
      })),
      total,
      page: 1,
      limit,
    };
  }

  async blockUser(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.customer.update({
      where: { id },
      data: { accountStatus: 'suspended' },
    });

    this.logger.log(`Usuário ${id} bloqueado`);
    return { success: true, message: 'Usuário bloqueado com sucesso' };
  }

  async unblockUser(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.customer.update({
      where: { id },
      data: { accountStatus: 'approved' },
    });

    this.logger.log(`Usuário ${id} desbloqueado`);
    return { success: true, message: 'Usuário desbloqueado com sucesso' };
  }

  private mapKycStatus(status: string): string {
    const map: Record<string, string> = {
      'not_requested': 'NOT_STARTED',
      'requested': 'PENDING',
      'in_review': 'PENDING',
      'approved': 'APPROVED',
      'rejected': 'REJECTED',
      'suspended': 'APPROVED',
    };
    return map[status] || 'NOT_STARTED';
  }

  private mapAccountStatus(status: string): string {
    const map: Record<string, string> = {
      'not_requested': 'ACTIVE',
      'requested': 'ACTIVE',
      'in_review': 'ACTIVE',
      'approved': 'ACTIVE',
      'rejected': 'ACTIVE',
      'suspended': 'BLOCKED',
    };
    return map[status] || 'ACTIVE';
  }

  private getDefaultDescription(type: string): string {
    const descriptions: Record<string, string> = {
      PIX_IN: 'Depósito via PIX',
      PIX_OUT: 'Saque via PIX',
      CONVERSION: 'Conversão BRL → USDT',
      TRANSFER: 'Transferência',
      PAYOUT: 'Pagamento USDT',
    };
    return descriptions[type] || type;
  }
}
