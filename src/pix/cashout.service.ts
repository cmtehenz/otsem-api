import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// import { MtBankClient } from './mtbank.client';
import { BrxClient } from './brx.client';
import { Decimal } from '@prisma/client/runtime/library';

type CreateCashOutInput = {
    walletId: string;
    amount: number; // em BRL
    pixKey: string;
    pixKeyType: string;
    beneficiaryName: string;
    beneficiaryTaxNumber: string;
    requestId: string; // idempotência do seu sistema (header ou gerado no FE)
};

@Injectable()
export class CashOutService {
    private readonly logger = new Logger(CashOutService.name);
    constructor(private prisma: PrismaService, private bank: BrxClient) { }

    async requestCashOut(input: CreateCashOutInput) {
        const amount = new Decimal(String(input.amount)).toDecimalPlaces(2);
        if (amount.lte(0)) throw new BadRequestException('amount_invalid');

        const wallet = await this.prisma.wallet.findUnique({ where: { id: input.walletId } });
        if (!wallet) throw new BadRequestException('wallet_not_found');
        if (wallet.currency !== 'BRL') throw new BadRequestException('wallet_currency_mismatch');

        // idempotência local (se já criamos um Payout com o mesmo requestId, retorna)
        const existing = await this.prisma.payout.findUnique({ where: { requestId: input.requestId } });
        if (existing) {
            return { ok: true, payoutId: existing.id, status: existing.status, endToEndId: existing.endToEndId };
        }

        if (new Decimal(wallet.balance).lt(amount)) {
            throw new ForbiddenException('insufficient_funds');
        }

        // Debita imediatamente (reserva) e cria o Payout
        const reference = `payout:${input.requestId}`;

        const result = await this.prisma.$transaction(async (trx) => {
            // cria débito (reserva de saldo)
            const updatedWallet = await trx.wallet.update({
                where: { id: wallet.id },
                data: { balance: new Decimal(wallet.balance).minus(amount) },
            });

            const debitTx = await trx.transaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'DEBIT',
                    amount,
                    reference, // único
                    metadata: {
                        reason: 'cash_out_request',
                        requestId: input.requestId,
                        pixKey: input.pixKey,
                    },
                },
            });

            const payout = await trx.payout.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    status: 'PENDING',
                    requestId: input.requestId,
                    beneficiaryName: input.beneficiaryName,
                    beneficiaryTaxNumber: input.beneficiaryTaxNumber,
                    pixKey: input.pixKey,
                    pixKeyType: input.pixKeyType,
                    debitTxId: debitTx.id,
                    bankRequest: {
                        amount: amount.toString(),
                        pixKey: input.pixKey,
                        pixKeyType: input.pixKeyType,
                        beneficiaryName: input.beneficiaryName,
                        beneficiaryTaxNumber: input.beneficiaryTaxNumber,
                        requestId: input.requestId,
                    },
                },
            });

            return { payout, updatedWallet, debitTx };
        });

        // Chamada ao banco (fora da transação)
        try {
            const bankResp = await this.bank.createPixOut({
                amount: Number(amount),
                pixKey: input.pixKey,
                pixKeyType: input.pixKeyType,
                beneficiaryName: input.beneficiaryName,
                beneficiaryTaxNumber: input.beneficiaryTaxNumber,
                requestId: input.requestId,
            })

            const endToEndId = String(bankResp?.endToEnd ?? '')
            const bankStatus = String(bankResp?.status ?? 'PROCESSING').toUpperCase()

            await this.prisma.payout.update({
                where: { id: result.payout.id },
                data: {
                    status: bankStatus === 'CONFIRMED' ? 'CONFIRMED' : 'PROCESSING',
                    endToEndId: endToEndId || null,
                    bankResponse: bankResp?.raw ?? bankResp,
                },
            })

            return { ok: true, payoutId: result.payout.id, endToEndId: endToEndId || null, status: bankStatus }
        } catch (err: any) {
            this.logger.error(`bank cash-out error: ${err?.message ?? err}`);

            // Falha na criação no banco → estorna (compensação)
            await this.refundPayout(result.payout.id, 'FAILED', 'bank_call_failed');

            return { ok: false, error: 'bank_call_failed' };
        }
    }

    // Chamado pelo webhook quando o banco confirma ou falha
    async settleByEndToEnd(endToEndId: string, status: string, raw: any) {
        const payout = await this.prisma.payout.findUnique({ where: { endToEndId } });
        if (!payout) return { ok: true, ignored: true };

        const normalized = status.toUpperCase();
        if (['CONFIRMED', 'COMPLETED', 'PAID'].includes(normalized)) {
            await this.prisma.payout.update({ where: { id: payout.id }, data: { status: 'CONFIRMED', bankResponse: raw } });
            return { ok: true, status: 'CONFIRMED' };
        }

        // Qualquer status de falha → estorno
        await this.refundPayout(payout.id, 'FAILED', `webhook_status_${normalized}`);
        return { ok: true, status: 'FAILED' };
    }

    // Estorno: cria CREDIT de compensação e marca payout FAILED
    private async refundPayout(payoutId: string, finalStatus: 'FAILED' | 'CANCELED', reason: string) {
        await this.prisma.$transaction(async (trx) => {
            const p = await trx.payout.findUnique({ where: { id: payoutId }, include: { wallet: true } });
            if (!p) return;

            // garantir idempotência do estorno usando reference único
            const refundRef = `payout_refund:${p.requestId}`;
            const already = await trx.transaction.findUnique({ where: { reference: refundRef } });
            if (!already) {
                // crédito de compensação
                const newBalance = new Decimal(p.wallet.balance).plus(p.amount);
                await trx.wallet.update({ where: { id: p.walletId }, data: { balance: newBalance } });
                await trx.transaction.create({
                    data: {
                        walletId: p.walletId,
                        type: 'CREDIT',
                        amount: p.amount,
                        reference: refundRef,
                        metadata: { reason: 'cash_out_refund', payoutId: p.id },
                    },
                });
            }

            await trx.payout.update({
                where: { id: p.id },
                data: { status: finalStatus, error: reason },
            });
        });
    }
}
