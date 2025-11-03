import { Injectable, BadRequestException, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';;
import { PrismaService } from '../prisma/prisma.service';
import { BrxAuthService } from '../brx/brx-auth.service';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import { QrCodeFormat, StaticQrRequest, StaticQrResult } from './pix.types';


type HistoryParams = {
    accountHolderId: string;
    page: number;
    pageSize: number;
    status?: string; // created|pending|confirmed|failed|refunded
};

type SendPixInput = {
    pixKey: string;
    amount: string;           // "10.00"
    description?: string;     // Message (até 140 chars)
    identifier?: string;      // idempotência (opcional). Se não vier, geramos.
    name?: string;            // opcional; se não vier, tentamos pré-consulta
    taxNumber?: string;       // opcional; se não vier, tentamos pré-consulta
    runPrecheck?: boolean;    // default true
};

@Injectable()
export class PixTransactionsService {
    private readonly baseUrl = process.env.BRX_BASE_URL ?? 'https://apisbank.brxbank.com.br';


    constructor(
        private readonly http: HttpService,
        private readonly prisma: PrismaService,
        private readonly brxAuth: BrxAuthService,) { }


    private centsToReal(cents: number | null): number {
        if (cents == null) return 0;
        return Number(cents) / 100;
    }

    private normalizeFormat(fmt?: QrCodeFormat): 'copy-paste' | 'image' | 'both' {
        if (fmt === 'copy-paste' || fmt === 'image' || fmt === 'both') return fmt;
        return 'both';
    }

    /** Junta `deposit` (entradas) e `payment` (saídas) num feed único */
    async getHistory({ accountHolderId, page, pageSize, status }: HistoryParams) {
        const skip = (page - 1) * pageSize;

        // filtros por status (normaliza)
        const statusMap = {
            created: ['CREATED'],
            pending: ['PENDING', 'PROCESSING'],
            confirmed: ['CONFIRMED', 'COMPLETED', 'PAID'],
            failed: ['FAILED', 'ERROR'],
            refunded: ['REFUNDED', 'ESTORNADO'],
        } as const;
        const whereDeposit: any = { accountHolderId: accountHolderId || undefined };
        const wherePayment: any = {};

        if (status && statusMap[status as keyof typeof statusMap]) {
            const list = statusMap[status as keyof typeof statusMap];
            // nos seus webhooks, `deposit.status` e `payment.status` são strings livres
            whereDeposit.status = { in: list };
            wherePayment.status = { in: list };
        }

        const [depositCount, paymentCount] = await Promise.all([
            this.prisma.deposit.count({ where: whereDeposit }),
            this.prisma.payment.count({ where: wherePayment }),
        ]);
        const total = depositCount + paymentCount;

        // Pegamos um range um pouco maior e depois ordenamos/limitamos
        const [deposits, payments] = await Promise.all([
            this.prisma.deposit.findMany({
                where: whereDeposit,
                orderBy: { receiptDate: 'desc' },
                take: pageSize,
                skip,
            }),
            this.prisma.payment.findMany({
                where: wherePayment,
                orderBy: { paymentDate: 'desc' },
                take: pageSize,
                skip,
            }),
        ]);

        // Normaliza para o shape do front
        const items = [
            ...deposits.map(d => ({
                id: `dep_${d.id}`,
                endToEndId: d.endToEnd || undefined,
                direction: 'in' as const,
                amount: this.centsToReal(d.receiptValue),
                key: d.receiverPixKey ?? undefined,
                keyType: undefined,
                description: d.payerMessage ?? null,
                status: (d.status || 'confirmed').toLowerCase(),
                createdAt: (d.receiptDate ?? d.createdAt).toISOString(),
                settledAt: d.receiptDate?.toISOString?.() ?? null,
                counterpartyName: d.payerName ?? null,
                counterpartyTaxNumber: d.payerTaxNumber ?? null,
            })),
            ...payments.map(p => ({
                id: `pay_${p.id}`,
                endToEndId: p.endToEnd || undefined,
                direction: 'out' as const,
                amount: this.centsToReal(p.paymentValue),
                key: p.receiverPixKey ?? undefined,
                keyType: undefined,
                description: p.errorMessage ? `Erro: ${p.errorMessage}` : null,
                status: (p.status || 'pending').toLowerCase(),
                createdAt: (p.paymentDate ?? p.createdAt).toISOString(),
                settledAt: null,
                counterpartyName: p.receiverName ?? null,
                counterpartyTaxNumber: p.receiverTaxNumber ?? null,
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
            items: items.slice(0, pageSize),
            total,
            page,
            pageSize,
        };
    }

    /* =========================================================
     * PRÉ-CONSULTA por chave (tenta caminhos conhecidos)
     * Retorna: { endToEndPixKey, name, taxNumber, bankData }
     * ========================================================= */
    async precheckKey(accountHolderId: string, pixKey: string, value: string) {
        const token = await this.brxAuth.getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };

        // 1) Caminho mais provável (pagamentos)
        const url1 = `${this.baseUrl}/pix/payments/account-holders/${encodeURIComponent(accountHolderId)}/key/${encodeURIComponent(pixKey)}?value=${encodeURIComponent(value)}`;

        // 2) Caminho alternativo (chaves)
        const url2 = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}/key/${encodeURIComponent(pixKey)}?value=${encodeURIComponent(value)}`;

        const tryFetch = async (url: string) => {
            try {
                const { data } = await firstValueFrom(this.http.get(url, { headers }));
                // Normaliza campos conhecidos
                const ext = data?.Extensions || data?.extensions;
                const d = ext?.Data || ext?.data;

                return {
                    endToEndPixKey:
                        d?.EndToEndPixKey || d?.EndToEnd || d?.endToEndPixKey || d?.endToEnd || null,
                    name: d?.Name || d?.name || null,
                    taxNumber: d?.TaxNumber || d?.taxNumber || null,
                    bankData: d?.BankData || d?.bankData || null,
                    raw: data,
                };
            } catch (err: any) {
                // 404/400 aqui só indica que essa rota não está disponível/esperando outro shape
                return null;
            }
        };

        const a = await tryFetch(url1);
        if (a?.endToEndPixKey) return a;

        const b = await tryFetch(url2);
        if (b?.endToEndPixKey) return b;

        throw new BadRequestException('Não foi possível pré-consultar a chave Pix no provedor.');
    }

    /* =========================================================
     * SEND PIX (obrigatório passar por pré-consulta)
     * 1) faz precheck -> obtém EndToEndPixKey + Nome/CPF/CNPJ
     * 2) efetiva pagamento via /key/previous-query
     * 3) grava PAYMENT como PROCESSING; webhook encerra o fluxo
     * ========================================================= */
    async sendPix(
        accountHolderId: string,
        dto: { pixKey: string; amount: string; description?: string; runPrecheck?: boolean }
    ) {
        const value = Number(dto.amount);
        if (!Number.isFinite(value) || value <= 0) {
            throw new BadRequestException('Valor inválido.');
        }
        // BRX tem mínimo (ex.: R$1,00). Ajuste se precisar:
        if (value < 1) throw new BadRequestException('O valor mínimo de pagamento é R$ 1,00.');

        const message = (dto.description ?? '').slice(0, 140);
        const identifier = uuidv4();

        // Pré-consulta é obrigatória para cumprir sua exigência
        const pre = await this.precheckKey(accountHolderId, dto.pixKey.trim(), dto.amount.trim());
        if (!pre?.endToEndPixKey) {
            throw new BadRequestException('Pré-consulta não retornou EndToEndPixKey.');
        }

        // Efetiva pagamento com previous-query
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/pix/payments/account-holders/${encodeURIComponent(accountHolderId)}/key/previous-query`;
        const body = {
            EndToEndPixKey: pre.endToEndPixKey,
            Value: value,
            Message: message,
            Identifier: identifier,
        };

        const { data } = await firstValueFrom(
            this.http.post(url, body, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            }),
        );

        // Normaliza campos do retorno
        const ext = data?.Extensions || data?.extensions;
        const d = ext?.Data || ext?.data || data;

        const endToEnd = d?.EndToEndPixKey || d?.endToEndPixKey || pre.endToEndPixKey || null;
        const receiverName = d?.Name || d?.name || pre?.name || null;
        const receiverTax = d?.TaxNumber || d?.taxNumber || pre?.taxNumber || null;

        // 💾 grava pagamento como PROCESSING (webhook confirmará)
        await this.prisma.payment.create({
            data: {
                endToEnd: endToEnd,
                identifier,
                paymentValue: Math.round(value * 100),
                paymentDate: new Date(),
                receiverPixKey: dto.pixKey.trim(),
                receiverName: receiverName ?? null,
                receiverTaxNumber: receiverTax ?? null,
                status: 'PROCESSING',
                bankPayload: data,
            },
        });

        return {
            ok: true,
            message: 'PIX solicitado com sucesso. Aguardando confirmação da BRX.',
            identifier,
            endToEndPixKey: endToEnd,
            receiver: { name: receiverName, taxNumber: receiverTax, bankData: pre.bankData ?? null },
        };
    }

    /** Gera QR Code estático na BRX e retorna PixCopyPaste e/ou Image base64 */
    async createStaticQr(accountHolderId: string, dto: StaticQrRequest): Promise<StaticQrResult> {
        if (!dto.pixKey?.trim()) {
            throw new BadRequestException('PixKey é obrigatório');
        }

        const token = await this.brxAuth.getAccessToken();
        const identifier = uuidv4();
        const format = this.normalizeFormat(dto.format);

        // BRX espera "QRCodeFormat" (static). Vamos mapear o enum nosso para o texto deles.
        const QRCodeFormat =
            format === 'both' ? 'both' :
                format === 'image' ? 'image' : 'copy-paste';

        const url = `${this.baseUrl}/pix/qr-code/account-holders/${accountHolderId}/static`;
        const body: any = {
            PixKey: dto.pixKey.trim(),
            Identifier: identifier,
            QRCodeFormat,
        };
        if (typeof dto.value !== 'undefined') body.Value = Number(dto.value);
        if (dto.message) body.Message = dto.message.slice(0, 140);

        const { data } = await firstValueFrom(
            this.http.post(url, body, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 15000,
            }),
        );

        const ext = data?.Extensions ?? data?.extensions;
        const d = ext?.Data ?? ext?.data ?? {};
        const qr = d?.QRCodeReturn ?? d?.qrCodeReturn ?? {};
        const copy = qr?.PixCopyPaste ?? null;
        const img = qr?.Image ?? qr?.ImageBase64 ?? null;

        // // (opcional) gravar uma "charge" local
        // await this.prisma.charge?.create?.({
        //     data: {
        //         identifier,
        //         pixKey: dto.pixKey.trim(),
        //         value: typeof dto.value === 'number' ? Math.round(dto.value * 100) : null,
        //         message: dto.message ?? null,
        //         format,
        //         payload: data,
        //     },
        // }).catch(() => { /* tabela pode não existir; ignorar */ });

        return {
            identifier,
            pixKey: dto.pixKey.trim(),
            value: typeof dto.value === 'number' ? dto.value : null,
            message: dto.message ?? null,
            format,
            copyPaste: copy,
            imageBase64: img,
        };
    }
}
