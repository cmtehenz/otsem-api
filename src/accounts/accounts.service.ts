// src/accounts/accounts.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
                    pixKeyType: pixKey ? 'MANUAL' : null,
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
        pixKeyType: string = 'MANUAL'
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
}