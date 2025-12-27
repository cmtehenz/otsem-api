import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(private prisma: PrismaService) {}

  async createAffiliate(data: {
    name: string;
    email: string;
    phone?: string;
    code: string;
    spreadRate: number;
    payoutWalletAddress?: string;
    payoutWalletNetwork?: string;
  }) {
    const existing = await this.prisma.affiliate.findFirst({
      where: {
        OR: [{ email: data.email }, { code: data.code }],
      },
    });

    if (existing) {
      throw new ConflictException('Afiliado com este email ou código já existe');
    }

    return this.prisma.affiliate.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        code: data.code.toUpperCase(),
        spreadRate: data.spreadRate,
        payoutWalletAddress: data.payoutWalletAddress,
        payoutWalletNetwork: data.payoutWalletNetwork,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [affiliates, total] = await Promise.all([
      this.prisma.affiliate.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { referredCustomers: true, commissions: true },
          },
        },
      }),
      this.prisma.affiliate.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: affiliates.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        code: a.code,
        spreadRate: Number(a.spreadRate),
        payoutWalletAddress: a.payoutWalletAddress,
        payoutWalletNetwork: a.payoutWalletNetwork,
        totalEarnings: Number(a.totalEarnings),
        pendingEarnings: Number(a.pendingEarnings),
        isActive: a.isActive,
        referredCustomersCount: a._count.referredCustomers,
        commissionsCount: a._count.commissions,
        createdAt: a.createdAt,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findById(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: {
        referredCustomers: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
        _count: { select: { commissions: true } },
      },
    });

    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return affiliate;
  }

  async findByCode(code: string) {
    return this.prisma.affiliate.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async updateAffiliate(id: string, data: Partial<{
    name: string;
    email: string;
    phone: string;
    spreadRate: number;
    payoutWalletAddress: string;
    payoutWalletNetwork: string;
    isActive: boolean;
  }>) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return this.prisma.affiliate.update({
      where: { id },
      data,
    });
  }

  async toggleActive(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return this.prisma.affiliate.update({
      where: { id },
      data: { isActive: !affiliate.isActive },
    });
  }

  async linkCustomerToAffiliate(customerId: string, affiliateCode: string) {
    const affiliate = await this.findByCode(affiliateCode);
    if (!affiliate) {
      throw new NotFoundException('Código de afiliado inválido');
    }

    if (!affiliate.isActive) {
      throw new ConflictException('Este afiliado não está ativo');
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { affiliateId: affiliate.id },
    });
  }

  async recordCommission(data: {
    affiliateId: string;
    customerId: string;
    transactionId?: string;
    transactionAmount: number;
    spreadTotal: number;
    spreadBase: number;
    spreadAffiliate: number;
  }) {
    const commissionBrl = data.transactionAmount * data.spreadAffiliate;

    this.logger.log(`[Affiliate] Recording commission: ${commissionBrl.toFixed(2)} BRL for affiliate ${data.affiliateId}`);

    const commission = await this.prisma.affiliateCommission.create({
      data: {
        affiliateId: data.affiliateId,
        customerId: data.customerId,
        transactionId: data.transactionId,
        transactionAmount: data.transactionAmount,
        spreadTotal: data.spreadTotal,
        spreadBase: data.spreadBase,
        spreadAffiliate: data.spreadAffiliate,
        commissionBrl,
      },
    });

    await this.prisma.affiliate.update({
      where: { id: data.affiliateId },
      data: {
        pendingEarnings: { increment: commissionBrl },
      },
    });

    return commission;
  }

  async getCommissions(affiliateId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [commissions, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where: { affiliateId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliateCommission.count({ where: { affiliateId } }),
    ]);

    return {
      data: commissions.map((c) => ({
        id: c.id,
        customerId: c.customerId,
        transactionId: c.transactionId,
        transactionAmount: Number(c.transactionAmount),
        spreadTotal: Number(c.spreadTotal),
        spreadBase: Number(c.spreadBase),
        spreadAffiliate: Number(c.spreadAffiliate),
        commissionBrl: Number(c.commissionBrl),
        status: c.status,
        paidAt: c.paidAt,
        createdAt: c.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async markCommissionsAsPaid(affiliateId: string, commissionIds: string[]) {
    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        id: { in: commissionIds },
        affiliateId,
        status: 'PENDING',
      },
    });

    if (commissions.length === 0) {
      throw new NotFoundException('Nenhuma comissão pendente encontrada');
    }

    const totalPaid = commissions.reduce(
      (sum, c) => sum + Number(c.commissionBrl),
      0,
    );

    await this.prisma.$transaction([
      this.prisma.affiliateCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      this.prisma.affiliate.update({
        where: { id: affiliateId },
        data: {
          pendingEarnings: { decrement: totalPaid },
          totalEarnings: { increment: totalPaid },
        },
      }),
    ]);

    return { paidCount: commissions.length, totalPaid };
  }

  async getAffiliateSpreadForCustomer(customerId: string): Promise<{
    affiliate: { id: string; code: string; spreadRate: number } | null;
    spreadBase: number;
    spreadAffiliate: number;
    spreadTotal: number;
  }> {
    const spreadBase = 0.0065; // 0.65% base

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { affiliate: true },
    });

    if (!customer?.affiliate || !customer.affiliate.isActive) {
      return {
        affiliate: null,
        spreadBase,
        spreadAffiliate: 0,
        spreadTotal: spreadBase,
      };
    }

    const spreadAffiliate = Number(customer.affiliate.spreadRate);
    const spreadTotal = spreadBase + spreadAffiliate;

    return {
      affiliate: {
        id: customer.affiliate.id,
        code: customer.affiliate.code,
        spreadRate: spreadAffiliate,
      },
      spreadBase,
      spreadAffiliate,
      spreadTotal,
    };
  }
}
