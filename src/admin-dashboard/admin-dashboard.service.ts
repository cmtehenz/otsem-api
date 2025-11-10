import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getSummary() {
        const now = new Date();
        const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [
            totalUsers,
            activeToday,
            deposits24h,
            payments24h,
            pixKeysActive,
            cardTxs24h,
            chargebacksOpen,
        ] = await Promise.all([
            // Total de usuários ativos
            this.prisma.user.count({ where: { isActive: true } }),

            // Usuários que atualizaram hoje
            this.prisma.user.count({
                where: { updatedAt: { gte: startOfDay } }
            }),

            // Depósitos últimas 24h (soma em centavos)
            this.prisma.deposit.aggregate({
                where: { createdAt: { gte: since24h } },
                _sum: { receiptValue: true },
            }),

            // Pagamentos últimas 24h (soma em centavos)
            this.prisma.payment.aggregate({
                where: { createdAt: { gte: since24h } },
                _sum: { paymentValue: true },
            }),

            // Chaves PIX ativas
            this.prisma.pixKey.count({
                where: { status: 'ACTIVE' },
            }),

            // Transações de cartão últimas 24h
            this.prisma.cardTransaction.count({
                where: {
                    createdAt: { gte: since24h },
                    status: { in: ['AUTHORIZED', 'CAPTURED'] },
                },
            }),

            // Chargebacks em aberto
            this.prisma.chargeback.count({
                where: { status: { in: ['OPENED', 'UNDER_ANALYSIS'] } },
            }),
        ]);

        // Volume BRL (centavos -> reais)
        const volumeCentavos =
            (deposits24h._sum.receiptValue ?? 0) +
            (payments24h._sum.paymentValue ?? 0);

        return {
            totalUsers,
            activeToday,
            volumeBRL: volumeCentavos / 100,
            pixKeys: pixKeysActive,
            cardTxs: cardTxs24h,
            chargebacks: chargebacksOpen,
        };
    }

    async getLatestUsers(limit = 10) {
        const users = await this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                role: true,
            },
        });

        return users.map(u => ({
            id: u.id,
            name: u.name ?? '(sem nome)',
            email: u.email,
            role: u.role,
            createdAt: u.createdAt.toISOString().split('T')[0],
        }));
    }

    async getLatestTransactions(limit = 15) {
        // Coleta depósitos, pagamentos, payouts e transações de cartão
        const [deposits, payments, payouts, cardTxs] = await Promise.all([
            this.prisma.deposit.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    createdAt: true,
                    receiptValue: true,
                    endToEnd: true,
                    payerName: true,
                },
            }),

            this.prisma.payment.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    createdAt: true,
                    paymentValue: true,
                    endToEnd: true,
                    receiverName: true,
                },
            }),

            this.prisma.payout.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    createdAt: true,
                    amount: true,
                    endToEndId: true,
                    status: true,
                    beneficiaryName: true,
                },
            }),

            this.prisma.cardTransaction.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    createdAt: true,
                    amount: true,
                    status: true,
                    merchantName: true,
                    cardBrand: true,
                    cardLast4: true,
                },
            }),
        ]);

        const items = [
            ...deposits.map(d => ({
                id: d.id,
                type: 'PIX_IN',
                asset: 'BRL',
                amount: d.receiptValue / 100,
                ref: d.endToEnd,
                createdAt: d.createdAt,
                desc: `Depósito Pix${d.payerName ? ` - ${d.payerName}` : ''}`,
            })),

            ...payments.map(p => ({
                id: p.id,
                type: 'PIX_OUT',
                asset: 'BRL',
                amount: p.paymentValue / 100,
                ref: p.endToEnd,
                createdAt: p.createdAt,
                desc: `Pagamento Pix${p.receiverName ? ` - ${p.receiverName}` : ''}`,
            })),

            ...payouts.map(o => ({
                id: o.id,
                type: 'PAYOUT',
                asset: 'BRL',
                amount: Number(o.amount),
                ref: o.endToEndId,
                createdAt: o.createdAt,
                desc: `Payout (${o.status})${o.beneficiaryName ? ` - ${o.beneficiaryName}` : ''}`,
            })),

            ...cardTxs.map(c => ({
                id: c.id,
                type: 'CARD',
                asset: 'BRL',
                amount: c.amount / 100,
                ref: `${c.cardBrand} *${c.cardLast4}`,
                createdAt: c.createdAt,
                desc: `${c.merchantName ?? 'Compra'} (${c.status})`,
            })),
        ]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

        return items.map(i => ({
            id: i.id,
            when: this.relative(i.createdAt),
            type: i.type,
            asset: i.asset,
            amount: i.amount,
            desc: i.desc,
        }));
    }

    private relative(date: Date): string {
        const diffMs = Date.now() - date.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `há ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `há ${hours} h`;
        const days = Math.floor(hours / 24);
        return `há ${days} d`;
    }
}