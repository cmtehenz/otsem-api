// src/inter/services/inter-pix.service.ts

import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InterAuthService } from './inter-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { SendPixDto, PixPaymentResponseDto } from '../dto/send-pix.dto';
import { CreatePixChargeDto } from '../dto/create-pix-charge.dto';
import { PixReceived } from '../types/pix-received.type';

@Injectable()
export class InterPixService {
    private readonly logger = new Logger(InterPixService.name);

    constructor(
        private readonly authService: InterAuthService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * 🔑 Obter chave Pix principal (do .env)
     */
    private getMainPixKey(): { chave: string; tipo: string } {
        const chave = this.configService.get<string>('INTER_PIX_KEY');
        const tipo = this.configService.get<string>('INTER_PIX_KEY_TYPE', 'CPF');

        if (!chave) {
            throw new BadRequestException(
                'Chave Pix não configurada. Configure INTER_PIX_KEY no .env',
            );
        }

        return { chave, tipo };
    }

    // ==================== COBRANÇAS (QR CODE) ====================

    /**
     * 📱 Criar cobrança Pix (QR Code)
     */
    async createCobranca(dto: CreatePixChargeDto): Promise<any> {
        this.logger.log(`📱 Criando cobrança Pix de R$ ${dto.valor}...`);

        const { chave } = this.getMainPixKey();

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.post('/banking/v2/pix/cobrancas', {
                calendario: {
                    expiracao: dto.expiracao || 3600, // 1 hora
                },
                valor: {
                    original: dto.valor.toFixed(2),
                },
                chave, // ✅ Usar chave do .env
                solicitacaoPagador: dto.descricao || 'Cobrança OTSEM Bank',
            });

            this.logger.log(`✅ Cobrança criada: ${response.data.txid}`);
            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Erro ao criar cobrança:', error.response?.data);
            throw new BadRequestException(
                error.response?.data?.message || 'Erro ao criar cobrança',
            );
        }
    }

    /**
     * 🔍 Consultar cobrança Pix pelo txid
     */
    async getCobranca(txid: string): Promise<any> {
        this.logger.log(`🔍 Consultando cobrança: ${txid}...`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get(`/banking/v2/pix/cobrancas/${txid}`);

            this.logger.log(`✅ Status: ${response.data.status}`);
            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Erro ao consultar cobrança:', error.response?.data);
            throw new BadRequestException(
                error.response?.data?.message || 'Erro ao consultar cobrança',
            );
        }
    }

    // ==================== ENVIAR PIX ====================

    /**
     * 💸 Enviar Pix para chave
     */
    async sendPix(
        customerId: string,
        dto: SendPixDto,
    ): Promise<PixPaymentResponseDto> {
        this.logger.log(
            `💸 Enviando Pix: R$ ${dto.valor} para ${dto.chaveDestino}`,
        );

        // ✅ 1. Validar saldo
        await this.validateBalance(customerId, dto.valor);

        // ✅ 2. Validar limites
        await this.validateLimits(customerId, dto.valor);

        try {
            const axios = this.authService.getAxiosInstance();

            // ✅ Payload da Inter (conforme documentação)
            const payload = {
                valor: dto.valor.toFixed(2),
                destinatario: {
                    tipo: dto.tipoChave,
                    chave: dto.chaveDestino,
                    ...(dto.nomeFavorecido && { nome: dto.nomeFavorecido }),
                },
                ...(dto.descricao && { descricao: dto.descricao }),
            };

            this.logger.debug('📤 Payload Inter:', JSON.stringify(payload, null, 2));

            const response = await axios.post('/banking/v2/pix/pagamentos', payload);

            const pixData = response.data;

            this.logger.log(
                `✅ Pix enviado: ${pixData.endToEndId || pixData.e2eId}`,
            );

            // ✅ 3. Registrar no banco
            await this.createPaymentRecord(customerId, dto, pixData);

            return {
                endToEndId: pixData.endToEndId || pixData.e2eId,
                valor: dto.valor,
                horario: pixData.horario || new Date().toISOString(),
                status: pixData.status || 'PROCESSANDO',
                transacaoId: pixData.transacaoId,
            };
        } catch (error: any) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            const details = error.response?.data;

            this.logger.error(`❌ Erro ao enviar Pix:`, {
                status,
                message,
                details,
            });

            // ✅ Registrar falha
            await this.createFailedPayment(customerId, dto, message);

            if (status === 400 || status === 422) {
                throw new BadRequestException(
                    `Erro ao enviar Pix: ${message}. Detalhes: ${JSON.stringify(details)}`,
                );
            }

            throw new InternalServerErrorException('Erro ao processar pagamento Pix');
        }
    }

    /**
     * 🔍 Consultar status de Pix enviado
     */
    async getPixStatus(endToEndId: string): Promise<any> {
        this.logger.log(`🔍 Consultando Pix: ${endToEndId}`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get(
                `/banking/v2/pix/pagamentos/${endToEndId}`,
            );

            return response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message;
            this.logger.error(`❌ Erro ao consultar Pix:`, message);
            throw new BadRequestException(`Erro ao consultar Pix: ${message}`);
        }
    }

    // ==================== VALIDAÇÕES ====================

    private async validateBalance(customerId: string, valor: number) {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: { id: true, balance: true, blockedAmount: true },
        });

        if (!account) {
            throw new BadRequestException('Conta não encontrada');
        }

        const valorDecimal = new Prisma.Decimal(valor);
        const blocked = account.blockedAmount || new Prisma.Decimal(0);
        const available = account.balance.sub(blocked);

        if (available.lessThan(valorDecimal)) {
            throw new BadRequestException(
                `Saldo insuficiente. Disponível: R$ ${available.toFixed(2)}`,
            );
        }
    }

    private async validateLimits(customerId: string, valor: number) {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: { id: true, dailyLimit: true, monthlyLimit: true },
        });

        if (!account) {
            throw new BadRequestException('Conta não encontrada');
        }

        const valorDecimal = new Prisma.Decimal(valor);

        // ✅ Limite diário
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalToday = await this.prisma.transaction.aggregate({
            where: {
                accountId: account.id,
                type: 'PIX_OUT',
                status: 'COMPLETED',
                createdAt: { gte: today },
            },
            _sum: { amount: true },
        });

        const usedToday = totalToday._sum.amount || new Prisma.Decimal(0);
        const remainingDaily = account.dailyLimit.sub(usedToday);

        if (remainingDaily.lessThan(valorDecimal)) {
            throw new BadRequestException(
                `Limite diário excedido. Disponível hoje: R$ ${remainingDaily.toFixed(2)}`,
            );
        }

        // ✅ Limite mensal
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const totalMonth = await this.prisma.transaction.aggregate({
            where: {
                accountId: account.id,
                type: 'PIX_OUT',
                status: 'COMPLETED',
                createdAt: { gte: firstDayOfMonth },
            },
            _sum: { amount: true },
        });

        const usedMonth = totalMonth._sum.amount || new Prisma.Decimal(0);
        const remainingMonthly = account.monthlyLimit.sub(usedMonth);

        if (remainingMonthly.lessThan(valorDecimal)) {
            throw new BadRequestException(
                `Limite mensal excedido. Disponível no mês: R$ ${remainingMonthly.toFixed(2)}`,
            );
        }

        this.logger.log(
            `✅ Limites OK | Diário: ${remainingDaily.toFixed(2)} | Mensal: ${remainingMonthly.toFixed(2)}`,
        );
    }

    // ==================== REGISTRO NO BANCO ====================

    private async createPaymentRecord(
        customerId: string,
        dto: SendPixDto,
        pixData: any,
    ) {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: { id: true, balance: true },
        });

        if (!account) throw new BadRequestException('Conta não encontrada');

        const valorDecimal = new Prisma.Decimal(dto.valor);
        const valorCentavos = Math.round(dto.valor * 100);

        const balanceBefore = account.balance;
        const balanceAfter = balanceBefore.sub(valorDecimal);

        const endToEnd =
            pixData.endToEndId || pixData.e2eId || `PIX-${Date.now()}`;

        await this.prisma.$transaction([
            this.prisma.payment.create({
                data: {
                    endToEnd,
                    identifier: pixData.transacaoId,
                    paymentValue: valorCentavos,
                    paymentDate: new Date(pixData.horario || new Date()),
                    receiverName: dto.nomeFavorecido,
                    receiverPixKey: dto.chaveDestino,
                    status: this.mapStatus(pixData.status),
                    bankPayload: pixData as Prisma.InputJsonValue,
                    customerId,
                },
            }),
            this.prisma.account.update({
                where: { id: account.id },
                data: { balance: balanceAfter },
            }),
            this.prisma.transaction.create({
                data: {
                    accountId: account.id,
                    type: 'PIX_OUT',
                    status: 'COMPLETED',
                    amount: valorDecimal,
                    balanceBefore,
                    balanceAfter,
                    description: dto.descricao || `Pix para ${dto.chaveDestino}`,
                    externalId: endToEnd,
                    externalData: pixData as Prisma.InputJsonValue,
                    completedAt: new Date(),
                },
            }),
        ]);

        this.logger.log(`✅ Pagamento registrado: ${endToEnd}`);
    }

    private async createFailedPayment(
        customerId: string,
        dto: SendPixDto,
        error: string,
    ) {
        const valorCentavos = Math.round(dto.valor * 100);

        await this.prisma.payment.create({
            data: {
                endToEnd: `FAILED-${Date.now()}`,
                paymentValue: valorCentavos,
                paymentDate: new Date(),
                receiverName: dto.nomeFavorecido,
                receiverPixKey: dto.chaveDestino,
                status: 'FAILED',
                errorMessage: error.substring(0, 500),
                bankPayload: { error } as Prisma.InputJsonValue,
                customerId,
            },
        });
    }

    private mapStatus(status: string): 'PENDING' | 'CONFIRMED' | 'FAILED' {
        const statusMap: Record<string, 'PENDING' | 'CONFIRMED' | 'FAILED'> = {
            PROCESSANDO: 'PENDING',
            CONCLUIDA: 'CONFIRMED',
            CONFIRMADA: 'CONFIRMED',
            FALHA: 'FAILED',
            REJEITADA: 'FAILED',
            CANCELADA: 'FAILED',
        };
        return statusMap[status?.toUpperCase()] || 'PENDING';
    }

    /**
     * 🔄 Buscar e processar Pix recebidos
     */
    async fetchAndProcessPixReceived(): Promise<void> {
        this.logger.log('🔄 Buscando Pix recebidos via API do Inter...');
        try {
            const { chave } = this.getMainPixKey();
            const axios = this.authService.getAxiosInstance();

            // Consulta Pix recebidos (ajuste endpoint conforme documentação Inter)
            const response = await axios.get(`/banking/v2/pix/${chave}/recebidos`, { timeout: 10000 });
            const pixList: PixReceived[] = response.data.pix || [];

            for (const pix of pixList) {
                // Verifica se já foi processado (evita duplicidade)
                const alreadyProcessed = await this.prisma.payment.findFirst({
                    where: { endToEnd: pix.e2eId },
                });
                if (alreadyProcessed) {
                    this.logger.warn(`🔁 Pix já processado: ${pix.e2eId}`);
                    continue;
                }

                // Busca customer pelo txid ou chave
                const customer = await this.prisma.customer.findFirst({
                    where: {
                        pixKeys: {
                            some: {
                                keyValue: pix.chave, // <-- campo correto!
                            },
                        },
                    },
                });

                if (!customer) {
                    this.logger.warn(`⚠️ Customer não encontrado para Pix: ${pix.txid}`);
                    continue;
                }

                // Salva pagamento recebido
                await this.prisma.payment.create({
                    data: {
                        endToEnd: pix.e2eId,
                        paymentValue: Math.round(pix.valor * 100),
                        paymentDate: new Date(pix.horario),
                        receiverName: customer.name,
                        receiverPixKey: pix.chave,
                        status: 'CONFIRMED',
                        bankPayload: pix as any,
                        customerId: customer.id,
                    },
                });

                // Atualiza saldo do cliente
                await this.prisma.account.update({
                    where: { customerId: customer.id },
                    data: {
                        balance: {
                            increment: pix.valor,
                        },
                    },
                });

                this.logger.log(`✅ Pix recebido salvo: ${pix.e2eId} | Customer: ${customer.id}`);
            }
        } catch (error: any) {
            this.logger.error('❌ Erro ao buscar/processar Pix recebidos:', error.message);
        }
    }
}