import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryConversionsDto } from './dto/query-conversions.dto';

@Injectable()
export class AdminConversionsService {
  private readonly logger = new Logger(AdminConversionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConversions(query: QueryConversionsDto) {
    const where: any = {
      type: 'CONVERSION',
    };

    if (query.dateStart) {
      where.createdAt = { ...where.createdAt, gte: new Date(query.dateStart) };
    }
    if (query.dateEnd) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.dateEnd) };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.account = { customerId: query.customerId };
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        account: {
          include: {
            customer: {
              select: { id: true, name: true, email: true, affiliateId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const affiliateIds = [
      ...new Set(
        transactions
          .map((t) => t.account?.customer?.affiliateId)
          .filter(Boolean),
      ),
    ] as string[];

    const affiliates = await this.prisma.affiliate.findMany({
      where: { id: { in: affiliateIds } },
      select: { id: true, code: true, name: true },
    });
    const affiliateMap = new Map(affiliates.map((a) => [a.id, a]));

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        transactionId: { in: transactions.map((t) => t.id) },
      },
    });
    const commissionMap = new Map(commissions.map((c) => [c.transactionId, c]));

    let filteredTransactions = transactions;
    if (query.affiliateId) {
      filteredTransactions = transactions.filter(
        (t) => t.account?.customer?.affiliateId === query.affiliateId,
      );
    }

    const data = filteredTransactions.map((tx) => {
      const customer = tx.account?.customer;
      const affiliate = customer?.affiliateId
        ? affiliateMap.get(customer.affiliateId)
        : null;
      const commission = commissionMap.get(tx.id);

      const metadata = (tx.metadata as any) || {};
      const brlPaid = Math.round(Number(tx.amount) * 100);
      const usdtCredited = metadata.usdtCredited
        ? Math.round(Number(metadata.usdtCredited) * 100)
        : 0;
      const exchangeRate = metadata.exchangeRate
        ? Math.round(Number(metadata.exchangeRate) * 100)
        : 0;
      const spreadPercent = metadata.spreadPercent || 0;
      const pixFee = metadata.pixFee ? Math.round(Number(metadata.pixFee) * 100) : 0;
      const okxFee = metadata.okxFee ? Math.round(Number(metadata.okxFee) * 100) : 0;
      const internalFee = metadata.internalFee
        ? Math.round(Number(metadata.internalFee) * 100)
        : 0;
      const totalFeesBrl = pixFee + okxFee + internalFee;
      const profitBrl = metadata.profitBrl
        ? Math.round(Number(metadata.profitBrl) * 100)
        : Math.round(brlPaid * (spreadPercent / 100));

      return {
        id: tx.id,
        createdAt: tx.createdAt,
        status: tx.status,
        customer: customer
          ? { id: customer.id, name: customer.name, email: customer.email }
          : null,
        brlPaid,
        usdtCredited,
        exchangeRateUsed: exchangeRate,
        spreadPercent,
        pixFee,
        okxFee,
        internalFee,
        totalFeesBrl,
        profitBrl,
        affiliate: affiliate
          ? { id: affiliate.id, code: affiliate.code, name: affiliate.name }
          : null,
        affiliateCommissionBrl: commission
          ? Math.round(Number(commission.commissionBrl) * 100)
          : 0,
        okxOrderId: metadata.okxOrderId || null,
        sourceOfBRL: metadata.sourceOfBRL || 'INTER',
      };
    });

    return { data };
  }

  async getConversionStats(query: QueryConversionsDto) {
    const where: any = {
      type: 'CONVERSION',
    };

    if (query.dateStart) {
      where.createdAt = { ...where.createdAt, gte: new Date(query.dateStart) };
    }
    if (query.dateEnd) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.dateEnd) };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.account = { customerId: query.customerId };
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        account: {
          include: {
            customer: { select: { affiliateId: true } },
          },
        },
      },
    });

    let filteredTransactions = transactions;
    if (query.affiliateId) {
      filteredTransactions = transactions.filter(
        (t) => t.account?.customer?.affiliateId === query.affiliateId,
      );
    }

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        transactionId: { in: filteredTransactions.map((t) => t.id) },
      },
    });

    let totalVolumeBrl = 0;
    let totalVolumeUsdt = 0;
    let totalProfit = 0;
    let rateSum = 0;
    let rateCount = 0;

    for (const tx of filteredTransactions) {
      const metadata = (tx.metadata as any) || {};
      const brlPaid = Number(tx.amount);
      const usdtCredited = metadata.usdtCredited ? Number(metadata.usdtCredited) : 0;
      const spreadPercent = metadata.spreadPercent || 0;
      const profitBrl = metadata.profitBrl
        ? Number(metadata.profitBrl)
        : brlPaid * (spreadPercent / 100);
      const exchangeRate = metadata.exchangeRate ? Number(metadata.exchangeRate) : 0;

      totalVolumeBrl += brlPaid;
      totalVolumeUsdt += usdtCredited;
      totalProfit += profitBrl;

      if (exchangeRate > 0) {
        rateSum += exchangeRate;
        rateCount++;
      }
    }

    const totalCommissions = commissions.reduce(
      (sum, c) => sum + Number(c.commissionBrl),
      0,
    );
    const netProfit = totalProfit - totalCommissions;

    return {
      data: {
        totalCount: filteredTransactions.length,
        volumeBrl: Math.round(totalVolumeBrl * 100),
        volumeUsdt: Math.round(totalVolumeUsdt * 100),
        grossProfit: Math.round(totalProfit * 100),
        netProfit: Math.round(netProfit * 100),
        avgRate: rateCount > 0 ? Math.round((rateSum / rateCount) * 100) : 0,
        totalCommissions: Math.round(totalCommissions * 100),
      },
    };
  }
}
