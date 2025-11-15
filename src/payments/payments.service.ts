import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentListFilter } from './types/payment-list.type';
import { PaymentResponse } from './types/payment-response.type';

@Injectable()
export class PaymentsService {
    constructor(private readonly prisma: PrismaService) { }

    async listPayments(filter: PaymentListFilter): Promise<PaymentResponse[]> {
        const where: any = {};

        if (filter.customerId) {
            where.customerId = filter.customerId;
        }
        if (filter.dataInicio || filter.dataFim) {
            where.paymentDate = {};
            if (filter.dataInicio) {
                where.paymentDate.gte = new Date(filter.dataInicio);
            }
            if (filter.dataFim) {
                where.paymentDate.lte = new Date(filter.dataFim);
            }
        }

        const payments = await this.prisma.payment.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            select: {
                id: true,
                endToEnd: true,
                paymentValue: true,
                paymentDate: true,
                status: true,
                receiverPixKey: true,
                customerId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        console.log('Filtro usado:', filter);
        console.log('Pagamentos encontrados:', payments.length);

        return payments;
    }
}