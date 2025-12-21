// src/transactions/transactions.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
    private readonly logger = new Logger(TransactionsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Processar depósito via Pix (chamado pelo webhook)
     */
    async processPixDeposit(
        pixKey: string,
        amount: number,
        payerData: any,
        externalId: string,
    ): Promise<any> {
        this.logger.log(`💰 Processando depósito Pix: R$ ${amount} para chave ${pixKey}`);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Buscar conta pela chave Pix
            const account = await tx.account.findUnique({
                where: { pixKey },
                include: { customer: true },
            });

            if (!account) {
                throw new BadRequestException(`Chave Pix ${pixKey} não encontrada`);
            }

            if (account.status !== 'active') {
                throw new BadRequestException('Conta inativa');
            }

            // 2. Verificar se transação já foi processada
            const existing = await tx.transaction.findUnique({
                where: { externalId },
            });

            if (existing) {
                this.logger.warn(`⚠️ Transação ${externalId} já foi processada`);
                return existing;
            }

            // 3. Criar transação
            const balanceBefore = account.balance;
            const balanceAfter = new Prisma.Decimal(balanceBefore).add(amount);

            const transaction = await tx.transaction.create({
                data: {
                    accountId: account.id,
                    type: 'PIX_IN',
                    amount,
                    balanceBefore,
                    balanceAfter,
                    status: 'COMPLETED',
                    description: `Pix recebido de ${payerData?.nome || 'N/A'}`,
                    externalId,
                    externalData: payerData,
                    completedAt: new Date(),
                },
            });

            // 4. Atualizar saldo da conta
            await tx.account.update({
                where: { id: account.id },
                data: { balance: balanceAfter },
            });

            this.logger.log(
                `✅ Depósito processado: ${account.customer.name} recebeu R$ ${amount}`
            );

            return transaction;
        });
    }

    /**
     * Processar saque via Pix
     */
    async processPixWithdraw(
        customerId: string,
        amount: number,
        pixKeyDestination: string,
        description?: string,
    ): Promise<any> {
        this.logger.log(`💸 Processando saque Pix: R$ ${amount} de customer ${customerId}`);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Buscar conta
            const account = await tx.account.findUnique({
                where: { customerId },
            });

            if (!account) {
                throw new BadRequestException('Conta não encontrada');
            }

            if (account.status !== 'active') {
                throw new BadRequestException('Conta inativa');
            }

            // 2. Verificar saldo
            const availableBalance = new Prisma.Decimal(account.balance).sub(
                account.blockedAmount
            );

            if (availableBalance.lessThan(amount)) {
                throw new BadRequestException('Saldo insuficiente');
            }

            // 3. Criar transação
            const balanceBefore = account.balance;
            const balanceAfter = new Prisma.Decimal(balanceBefore).sub(amount);

            const transaction = await tx.transaction.create({
                data: {
                    accountId: account.id,
                    type: 'PIX_OUT',
                    amount,
                    balanceBefore,
                    balanceAfter,
                    status: 'PROCESSING',
                    description: description || `Pix enviado para ${pixKeyDestination}`,
                    metadata: { pixKeyDestination },
                },
            });

            // 4. Atualizar saldo da conta
            await tx.account.update({
                where: { id: account.id },
                data: { balance: balanceAfter },
            });

            this.logger.log(`✅ Saque iniciado: Transaction ID ${transaction.id}`);

            return transaction;
        });
    }

    /**
     * Transferência entre customers (P2P)
     */
    async processTransfer(
        fromCustomerId: string,
        toPixKey: string,
        amount: number,
        description?: string,
    ): Promise<any> {
        this.logger.log(`🔄 Processando transferência P2P: R$ ${amount}`);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Buscar conta de origem
            const fromAccount = await tx.account.findUnique({
                where: { customerId: fromCustomerId },
            });

            if (!fromAccount) {
                throw new BadRequestException('Conta de origem não encontrada');
            }

            // 2. Buscar conta de destino pela chave Pix
            const toAccount = await tx.account.findUnique({
                where: { pixKey: toPixKey },
            });

            if (!toAccount) {
                throw new BadRequestException('Chave Pix de destino não encontrada');
            }

            if (fromAccount.id === toAccount.id) {
                throw new BadRequestException('Não é possível transferir para si mesmo');
            }

            // 3. Verificar saldo
            const availableBalance = new Prisma.Decimal(fromAccount.balance).sub(
                fromAccount.blockedAmount
            );

            if (availableBalance.lessThan(amount)) {
                throw new BadRequestException('Saldo insuficiente');
            }

            // 4. Criar transação de débito
            const txOut = await tx.transaction.create({
                data: {
                    accountId: fromAccount.id,
                    type: 'TRANSFER_OUT',
                    amount,
                    balanceBefore: fromAccount.balance,
                    balanceAfter: new Prisma.Decimal(fromAccount.balance).sub(amount),
                    status: 'COMPLETED',
                    description: description || `Transferência para ${toPixKey}`,
                    completedAt: new Date(),
                },
            });

            // 5. Criar transação de crédito
            const txIn = await tx.transaction.create({
                data: {
                    accountId: toAccount.id,
                    type: 'TRANSFER_IN',
                    amount,
                    balanceBefore: toAccount.balance,
                    balanceAfter: new Prisma.Decimal(toAccount.balance).add(amount),
                    status: 'COMPLETED',
                    description: description || `Transferência recebida`,
                    relatedTxId: txOut.id,
                    completedAt: new Date(),
                },
            });

            // 6. Atualizar saldos
            await tx.account.update({
                where: { id: fromAccount.id },
                data: { balance: new Prisma.Decimal(fromAccount.balance).sub(amount) },
            });

            await tx.account.update({
                where: { id: toAccount.id },
                data: { balance: new Prisma.Decimal(toAccount.balance).add(amount) },
            });

            this.logger.log(`✅ Transferência concluída: ${txOut.id} → ${txIn.id}`);

            return { txOut, txIn };
        });
    }

    /**
     * Listar transações de uma conta com paginação
     */
    async findByAccount(accountId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where: { accountId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.transaction.count({
                where: { accountId },
            }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };
    }

    /**
     * Buscar transação por ID
     */
    async findOne(id: string) {
        return this.prisma.transaction.findUnique({
            where: { id },
            include: {
                account: {
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Atualizar status de transação
     */
    async updateStatus(
        id: string,
        status: string,
        externalId?: string,
        externalData?: any,
    ) {
        return this.prisma.transaction.update({
            where: { id },
            data: {
                status,
                ...(externalId && { externalId }),
                ...(externalData && { externalData }),
                ...(status === 'COMPLETED' && { completedAt: new Date() }),
            },
        });
    }

    /**
     * Reverter transação (estorno)
     */
    async reverseTransaction(transactionId: string, reason?: string) {
        this.logger.log(`🔄 Revertendo transação ${transactionId}`);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Buscar transação original
            const originalTx = await tx.transaction.findUnique({
                where: { id: transactionId },
                include: { account: true },
            });

            if (!originalTx) {
                throw new BadRequestException('Transação não encontrada');
            }

            if (originalTx.status === 'REVERSED') {
                throw new BadRequestException('Transação já foi revertida');
            }

            // 2. Criar transação reversa
            const reverseTx = await tx.transaction.create({
                data: {
                    accountId: originalTx.accountId,
                    type: originalTx.type === 'PIX_IN' ? 'PIX_OUT' : 'PIX_IN',
                    amount: originalTx.amount,
                    balanceBefore: originalTx.account.balance,
                    balanceAfter:
                        originalTx.type === 'PIX_IN'
                            ? new Prisma.Decimal(originalTx.account.balance).sub(originalTx.amount)
                            : new Prisma.Decimal(originalTx.account.balance).add(originalTx.amount),
                    status: 'COMPLETED',
                    description: `Estorno: ${reason || originalTx.description}`,
                    relatedTxId: originalTx.id,
                    completedAt: new Date(),
                },
            });

            // 3. Atualizar saldo
            const newBalance =
                originalTx.type === 'PIX_IN'
                    ? new Prisma.Decimal(originalTx.account.balance).sub(originalTx.amount)
                    : new Prisma.Decimal(originalTx.account.balance).add(originalTx.amount);

            await tx.account.update({
                where: { id: originalTx.accountId },
                data: { balance: newBalance },
            });

            // 4. Marcar transação original como revertida
            await tx.transaction.update({
                where: { id: transactionId },
                data: { status: 'REVERSED' },
            });

            this.logger.log(`✅ Transação ${transactionId} revertida`);

            return reverseTx;
        });
    }
}