// src/accounts/accounts.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountSummary } from './types/account-summary.type';
import { PaymentSummary } from './types/payment-summary.type';

@Injectable()
export class AccountsService {
    private readonly logger = new Logger(AccountsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Criar conta para customer (ao aprovar cadastro)
     * Versão SEM cadastro automático de chave Pix
     */
    async createAccount(customerId: string, pixKey?: string): Promise<any> {
        this.logger.log(`🏦 Criando conta para customer ${customerId}`);

        // Verificar se já existe
        const existing = await this.prisma.account.findUnique({
            where: { customerId },
        });

        if (existing) {
            throw new BadRequestException('Customer já possui conta');
        }

        try {
            // Criar conta no banco de dados
            const account = await this.prisma.account.create({
                data: {
                    customerId,
                    balance: 0,
                    status: 'active',
                    pixKey: pixKey || null, // Chave Pix opcional (cadastrada manualmente)
                    pixKeyType: pixKey ? PixKeyType.RANDOM : null,
                },
            });

            this.logger.log(
                `✅ Conta criada${pixKey ? ` com chave Pix: ${pixKey}` : ' (sem chave Pix)'}`
            );

            return account;
        } catch (error) {
            this.logger.error('❌ Erro ao criar conta:', error);
            throw error;
        }
    }

    /**
     * Atualizar chave Pix da conta (Admin)
     */
    async updatePixKey(
        customerId: string,
        pixKey: string,
        pixKeyType: PixKeyType = PixKeyType.RANDOM,
    ): Promise<any> {
        this.logger.log(`🔑 Atualizando chave Pix do customer ${customerId}: ${pixKey}`);

        const account = await this.prisma.account.findUnique({
            where: { customerId },
        });

        if (!account) {
            throw new BadRequestException('Conta não encontrada');
        }

        return this.prisma.account.update({
            where: { customerId },
            data: {
                pixKey,
                pixKeyType,
            },
        });
    }

    /**
     * Obter conta por chave Pix (para webhook)
     */
    async getAccountByPixKey(pixKey: string): Promise<any> {
        return this.prisma.account.findUnique({
            where: { pixKey },
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }

    /**
     * Obter saldo do customer
     */
    async getBalance(customerId: string): Promise<any> {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
        });

        if (!account) {
            throw new BadRequestException('Conta não encontrada');
        }

        return {
            customerId: account.customerId,
            balance: account.balance,
            blockedAmount: account.blockedAmount,
            availableBalance: parseFloat(account.balance.toString()) -
                parseFloat(account.blockedAmount.toString()),
            pixKey: account.pixKey,
            status: account.status,
        };
    }

    /**
     * Obter resumo da conta e pagamentos do customer
     */
    async getAccountSummary(customerId: string): Promise<AccountSummary | null> {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: {
                id: true,
                balance: true,
                status: true,
                pixKey: true,
                pixKeyType: true,
                dailyLimit: true,
                monthlyLimit: true,
                blockedAmount: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!account) return null;

        const payments = await this.prisma.payment.findMany({
            where: {
                customerId,
                status: 'CONFIRMED',
                paymentValue: { gt: 0 }, // apenas entradas
            },
            orderBy: { paymentDate: 'desc' },
            select: {
                id: true,
                paymentValue: true,
                paymentDate: true,
                receiverPixKey: true,
                endToEnd: true,
                bankPayload: true,
            },
        });

        return {
            ...account,
            balance: parseFloat(account.balance.toString()),
            dailyLimit: account.dailyLimit ? parseFloat(account.dailyLimit.toString()) : 0,
            monthlyLimit: account.monthlyLimit ? parseFloat(account.monthlyLimit.toString()) : 0,
            blockedAmount: account.blockedAmount ? parseFloat(account.blockedAmount.toString()) : 0,
            payments,
        };
    }
}