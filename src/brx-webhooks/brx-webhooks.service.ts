// src/brx-webhooks/brx-webhooks.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Request } from 'express';

const prisma = new PrismaClient();

// Schemas (aceitando AccoutHolderId e AccountHolderId)
const baseIdSchema = z.object({
    AccoutHolderId: z.string().uuid().optional(),
    AccountHolderId: z.string().uuid().optional(),
    EndToEnd: z.string().min(3),
});

// CASH-IN
const cashInSchema = baseIdSchema.extend({
    ReceiptValue: z.number(), // Decimal (vamos tratar como reais)
    ReceiptDate: z.string().datetime({ offset: false }).or(z.string()),

    PayerName: z.string().optional(),
    PayerTaxNumber: z.string().optional(),
    PayerBankCode: z.string().optional(),
    PayerBankBranch: z.string().optional(),
    PayerBankAccount: z.string().optional(),
    PayerBankAccountDigit: z.string().optional(),
    PayerISPB: z.string().optional(),
    PayerMessage: z.string().optional(),

    ReceiverName: z.string().optional(),
    ReceiverTaxNumber: z.string().optional(),
    ReceiverBankCode: z.string().optional(),
    ReceiverBankBranch: z.string().optional(),
    ReceiverBankAccount: z.string().optional(),
    ReceiverBankAccountDigit: z.string().optional(),
    ReceiverISPB: z.string().optional(),
    ReceiverPixKey: z.string().optional(),

    Status: z.string().optional(),
    StatusId: z.number().optional(),
});

// CASH-OUT
const cashOutSchema = baseIdSchema.extend({
    Identifier: z.string().optional(),
    PaymentValue: z.number(),
    PaymentDate: z.string().datetime({ offset: false }).or(z.string()),

    ReceiverName: z.string().optional(),
    ReceiverTaxNumber: z.string().optional(),
    ReceiverBankCode: z.string().optional(),
    ReceiverBankBranch: z.string().optional(),
    ReceiverBankAccount: z.string().optional(),
    ReceiverISPB: z.string().optional(),
    ReceiverPixKey: z.string().optional(),

    PayerName: z.string().optional(),
    PayerTaxNumber: z.string().optional(),
    PayerBankCode: z.string().optional(),
    PayerBankBranch: z.string().optional(),
    PayerBankAccount: z.string().optional(),
    PayerISPB: z.string().optional(),

    Status: z.string().optional(),
    StatusId: z.number().optional(),
    ErrorMessage: z.string().nullable().optional(),
});

// REFUND (dados detalhados dependem do endpoint de “Consulta de Devolução”)
const refundSchema = baseIdSchema.extend({
    Status: z.string().optional(),
    StatusId: z.number().optional(),
    // Campos adicionais se a BRX enviar no webhook; manteremos flexível:
}).passthrough();

@Injectable()
export class BrxWebhooksService {
    // Se a BRX passar a assinar, adicione verificação aqui
    private checkSignature(_req: Request, _headers: any): boolean | null {
        return null; // sem assinatura na doc fornecida
    }

    private getAccountHolderId(obj: any): string | undefined {
        return obj.AccountHolderId ?? obj.AccoutHolderId;
    }

    // Mapeamento de cliente por CPF/CNPJ ou pelo AccountHolderId caso você controle localmente
    private async resolveCustomerId(payerTaxNumber?: string) {
        if (!payerTaxNumber) return null;
        const clean = payerTaxNumber.replace(/\D/g, '');
        const found = await prisma.customer.findUnique({ where: { taxNumber: clean } });
        return found ? found.id : null;
    }

    async handleCashIn(req: Request, headers: any) {
        const body = req.body;
        const parsed = cashInSchema.parse(body);

        const endToEnd = parsed.EndToEnd;
        const existing = await prisma.deposit.findUnique({ where: { endToEnd } });
        if (existing) {
            // idempotência: já armazenado
            await prisma.webhookEvent.create({
                data: {
                    kind: 'cash-in',
                    endToEnd,
                    rawBody: body,
                    headers,
                    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
                    signatureOk: this.checkSignature(req, headers),
                },
            });
            return;
        }

        const accountHolderId = this.getAccountHolderId(parsed);
        const customerId = await this.resolveCustomerId(parsed.PayerTaxNumber);

        await prisma.$transaction([
            prisma.deposit.create({
                data: {
                    endToEnd,
                    accountHolderId: accountHolderId ?? null,
                    receiptValue: Math.round(parsed.ReceiptValue * 100),
                    receiptDate: new Date(parsed.ReceiptDate),
                    payerName: parsed.PayerName,
                    payerTaxNumber: parsed.PayerTaxNumber?.replace(/\D/g, ''),
                    payerBankCode: parsed.PayerBankCode,
                    payerBankBranch: parsed.PayerBankBranch,
                    payerBankAccount: parsed.PayerBankAccount,
                    payerBankAccountDigit: parsed.PayerBankAccountDigit,
                    payerISPB: parsed.PayerISPB,
                    payerMessage: parsed.PayerMessage,
                    receiverName: parsed.ReceiverName,
                    receiverTaxNumber: parsed.ReceiverTaxNumber?.replace(/\D/g, ''),
                    receiverBankCode: parsed.ReceiverBankCode,
                    receiverBankBranch: parsed.ReceiverBankBranch,
                    receiverBankAccount: parsed.ReceiverBankAccount,
                    receiverBankAccountDigit: parsed.ReceiverBankAccountDigit,
                    receiverISPB: parsed.ReceiverISPB,
                    receiverPixKey: parsed.ReceiverPixKey,
                    status: parsed.Status,
                    statusId: parsed.StatusId,
                    bankPayload: body,
                    customerId,
                },
            }),
            prisma.webhookEvent.create({
                data: {
                    kind: 'cash-in',
                    endToEnd,
                    rawBody: body,
                    headers,
                    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
                    signatureOk: this.checkSignature(req, headers),
                },
            }),
        ]);
    }

    async handleCashOut(req: Request, headers: any) {
        const body = req.body;
        const parsed = cashOutSchema.parse(body);

        const endToEnd = parsed.EndToEnd;
        const existing = await prisma.payment.findUnique({ where: { endToEnd } });
        if (existing) {
            await prisma.webhookEvent.create({
                data: { kind: 'cash-out', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress || undefined }
            });
            return;
        }

        const customerId = await this.resolveCustomerId(parsed.PayerTaxNumber);

        await prisma.$transaction([
            prisma.payment.create({
                data: {
                    endToEnd,
                    identifier: parsed.Identifier ?? null,
                    paymentValue: Math.round(parsed.PaymentValue * 100),
                    paymentDate: new Date(parsed.PaymentDate),
                    receiverName: parsed.ReceiverName,
                    receiverTaxNumber: parsed.ReceiverTaxNumber?.replace(/\D/g, ''),
                    receiverBankCode: parsed.ReceiverBankCode,
                    receiverBankBranch: parsed.ReceiverBankBranch,
                    receiverBankAccount: parsed.ReceiverBankAccount,
                    receiverISPB: parsed.ReceiverISPB,
                    receiverPixKey: parsed.ReceiverPixKey,
                    payerName: parsed.PayerName,
                    payerTaxNumber: parsed.PayerTaxNumber?.replace(/\D/g, ''),
                    payerBankCode: parsed.PayerBankCode,
                    payerBankBranch: parsed.PayerBankBranch,
                    payerBankAccount: parsed.PayerBankAccount,
                    payerISPB: parsed.PayerISPB,
                    status: parsed.Status,
                    statusId: parsed.StatusId,
                    errorMessage: parsed.ErrorMessage ?? null,
                    bankPayload: body,
                    customerId,
                },
            }),
            prisma.webhookEvent.create({
                data: { kind: 'cash-out', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress || undefined }
            }),
        ]);
    }

    async handleRefund(req: Request, headers: any) {
        const body = req.body;
        const parsed = refundSchema.parse(body);
        const endToEnd = parsed.EndToEnd;

        const existing = await prisma.refund.findUnique({ where: { endToEnd } });
        if (existing) {
            await prisma.webhookEvent.create({
                data: { kind: 'refunds', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress || undefined }
            });
            return;
        }

        // Tentar deduzir customer por CPF do pagador/recebedor se vier no payload (doc resumida não detalha)
        let customerId: string | null = null;
        const taxNumber = (body?.PayerTaxNumber || body?.ReceiverTaxNumber) as string | undefined;
        if (taxNumber) {
            customerId = await this.resolveCustomerId(taxNumber);
        }

        await prisma.$transaction([
            prisma.refund.create({
                data: {
                    endToEnd,
                    status: (body?.Status as string) ?? null,
                    statusId: typeof body?.StatusId === 'number' ? body.StatusId : null,
                    valueCents: body?.RefundValue ? Math.round(Number(body.RefundValue) * 100) : null,
                    refundDate: body?.RefundDate ? new Date(body.RefundDate) : null,
                    bankPayload: body,
                    customerId,
                },
            }),
            prisma.webhookEvent.create({
                data: { kind: 'refunds', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress || undefined }
            }),
        ]);
    }
}
