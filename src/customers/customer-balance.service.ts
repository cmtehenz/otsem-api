import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatementsService } from '../statements/statements.service';
import { DepositStatus } from '@prisma/client';

@Injectable()
export class CustomerBalanceService {
    private readonly logger = new Logger(CustomerBalanceService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly statements: StatementsService,
    ) { }

    async getBalanceByCustomerId(customerId: string) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer não encontrado');

        if (!customer.externalClientId) {
            return {
                available: 0,
                blocked: 0,
                total: 0,
                currency: 'BRL',
                accountHolderId: null,
                pixKey: null,
                updatedAt: new Date().toISOString(),
                pendingExternalActivation: true,
            };
        }

        // Delegar para StatementsService (já existente)
        const raw = await this.statements.getBalance(customer.externalClientId).catch(() => null);

        if (!raw) {
            this.logger.warn(`Saldo não disponível para externalClientId=${customer.externalClientId}`);
            return {
                available: 0,
                blocked: 0,
                total: 0,
                currency: 'BRL',
                accountHolderId: customer.externalClientId,
                pixKey: null,
                updatedAt: new Date().toISOString(),
                pendingExternalActivation: true,
            };
        }

        return {
            available: raw.availableBalance ?? raw.balance ?? 0,
            blocked: raw.blockedAmount ?? raw.blockedBalance ?? 0,
            total: (raw.availableBalance ?? raw.balance ?? 0) + (raw.blockedAmount ?? raw.blockedBalance ?? 0),
            currency: 'BRL',
            accountHolderId: customer.externalClientId,
            pixKey: raw.pixKey ?? null,
            updatedAt: raw.updatedAt ?? new Date().toISOString(),
        };
    }

    async getPixBalanceByCustomerId(customerId: string) {
        // Busca a chave Pix do customer
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            select: { pixKeys: true },
        });
        if (!customer) throw new NotFoundException('Customer não encontrado');
        const pixKeyObj = customer.pixKeys && customer.pixKeys.length > 0 ? customer.pixKeys[0] : null;
        const pixKeyValue = pixKeyObj ? pixKeyObj.keyValue : null;

        if (!pixKeyValue) {
            return {
                available: 0,
                blocked: 0,
                total: 0,
                currency: 'BRL',
                pixKey: null,
                updatedAt: new Date().toISOString(),
            };
        }

        // Soma todos os depósitos confirmados recebidos pela chave Pix do customer
        const deposits = await this.prisma.deposit.findMany({
            where: {
                receiverPixKey: pixKeyValue,
                status: DepositStatus.CONFIRMED,
            },
            select: { receiptValue: true },
        });

        const total = deposits.reduce((sum, d) => sum + d.receiptValue, 0);

        return {
            available: total,
            blocked: 0,
            total,
            currency: 'BRL',
            pixKey: pixKeyValue,
            updatedAt: new Date().toISOString(),
        };
    }
}