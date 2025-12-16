// src/inter/services/inter-webhook.service.ts

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
import * as crypto from 'crypto';
import {
    CreateWebhookCallbackDto,
    UpdateWebhookCallbackDto,
} from '../dto/webhook.dto';

@Injectable()
export class InterWebhookService {
    private readonly logger = new Logger(InterWebhookService.name);

    constructor(
        private readonly authService: InterAuthService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        // ✅ Validar configurações obrigatórias
        this.validateConfig();
    }

    /**
     * 🔍 Validar configurações obrigatórias
     */
    private validateConfig() {
        const required = {
            INTER_PIX_KEY: this.configService.get<string>('INTER_PIX_KEY'),
            INTER_CONTA_CORRENTE: this.configService.get<string>('INTER_CONTA_CORRENTE'),
            INTER_CLIENT_ID: this.configService.get<string>('INTER_CLIENT_ID'),
            INTER_CLIENT_SECRET: this.configService.get<string>('INTER_CLIENT_SECRET'),
        };

        const missing = Object.entries(required)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missing.length > 0) {
            this.logger.error(`❌ Variáveis obrigatórias não configuradas: ${missing.join(', ')}`);
            this.logger.error('Configure-as no arquivo .env antes de continuar.');
        } else {
            this.logger.log('✅ Todas as variáveis obrigatórias estão configuradas');
        }
    }

    // ==================== GERENCIAR CALLBACKS ====================

    /**
     * 📋 Consultar callback cadastrado
     */
    async getCallbacks(tipoWebhook: string): Promise<any> {
        this.logger.log(`📋 Consultando callbacks: ${tipoWebhook}`);

        try {
            const axios = this.authService.getAxiosInstance();

            if (tipoWebhook === 'pix') {
                const pixKey = this.configService.get<string>('INTER_PIX_KEY');
                if (!pixKey) {
                    throw new BadRequestException('INTER_PIX_KEY não configurada');
                }

                const contaCorrente = this.configService.get<string>(
                    'INTER_CONTA_CORRENTE',
                );

                const response = await axios.get(
                    `/pix/v2/webhook/${encodeURIComponent(pixKey)}`,
                    {
                        headers: {
                            'x-conta-corrente': contaCorrente,
                        },
                    },
                );

                this.logger.log(`✅ Callback encontrado: ${response.data.webhookUrl}`);
                return response.data;
            }

            if (tipoWebhook === 'boletos') {
                const response = await axios.get(`/banking/v2/webhooks/boletos`);
                this.logger.log(`✅ Callback encontrado: ${response.data.webhookUrl}`);
                return response.data;
            }

            throw new BadRequestException('Tipo inválido');
        } catch (error: any) {
            const status = error.response?.status;

            // ✅ 404 é esperado quando não há webhook cadastrado
            if (status === 404) {
                this.logger.warn('⚠️ Nenhum callback cadastrado ainda');
                return { webhookUrl: null, message: 'Nenhum callback cadastrado' };
            }

            // ✅ Outros erros: logar detalhes
            this.logger.error('❌ Erro ao consultar callbacks:');
            this.logger.error(`   Status: ${status}`);
            this.logger.error(`   Message: ${error.message}`);
            this.logger.error(`   Data:`, JSON.stringify(error.response?.data, null, 2));
            this.logger.error(`   URL: ${error.config?.baseURL}${error.config?.url}`);

            // ✅ Não lançar exceção, retornar resposta vazia
            return {
                webhookUrl: null,
                message: error.response?.data?.message || 'Erro ao consultar callbacks',
                error: true,
            };
        }
    }

    /**
     * ➕ Criar callback de webhook Pix (usa PUT na Inter)
     */
    async createCallback(
        tipoWebhook: string,
        dto: CreateWebhookCallbackDto,
    ): Promise<any> {
        this.logger.log(`➕ Criando callback ${tipoWebhook}: ${dto.webhookUrl}`);

        try {
            const axios = this.authService.getAxiosInstance();

            // ✅ Pix usa endpoint /pix/v2/webhook/{chave}
            if (tipoWebhook === 'pix') {
                const pixKey = this.configService.get<string>('INTER_PIX_KEY');
                if (!pixKey) {
                    throw new BadRequestException(
                        'INTER_PIX_KEY não configurada no .env. Configure a chave Pix principal.',
                    );
                }

                const contaCorrente = this.configService.get<string>('INTER_CONTA_CORRENTE');
                if (!contaCorrente) {
                    throw new BadRequestException(
                        'INTER_CONTA_CORRENTE não configurada no .env',
                    );
                }

                const endpoint = `/pix/v2/webhook/${encodeURIComponent(pixKey)}`;
                const fullUrl = `${axios.defaults.baseURL}${endpoint}`;

                this.logger.debug(`📍 URL completa: ${fullUrl}`);
                this.logger.debug(`📤 Método: PUT`);
                this.logger.debug(`📦 Payload: ${JSON.stringify({ webhookUrl: dto.webhookUrl })}`);
                this.logger.debug(`🔑 Chave Pix: ${pixKey}`);
                this.logger.debug(`🏦 Conta Corrente: ${contaCorrente}`);

                const response = await axios.put(
                    endpoint,
                    { webhookUrl: dto.webhookUrl },
                    {
                        headers: {
                            'x-conta-corrente': contaCorrente,
                        },
                    },
                );

                this.logger.log(`✅ Webhook Pix cadastrado com sucesso!`);
                return response.data;
            }

            // ✅ Boletos usa endpoint /banking/v2/webhooks/boletos
            if (tipoWebhook === 'boletos') {
                const endpoint = `/banking/v2/webhooks/boletos`;
                const response = await axios.put(endpoint, {
                    webhookUrl: dto.webhookUrl,
                });

                this.logger.log(`✅ Webhook Boleto cadastrado com sucesso!`);
                return response.data;
            }

            throw new BadRequestException(
                'Tipo de webhook inválido. Use: pix ou boletos',
            );
        } catch (error: any) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            const data = error.response?.data;

            this.logger.error(`❌ Erro ao criar callback ${tipoWebhook}:`);
            this.logger.error(`   Status: ${status}`);
            this.logger.error(`   Message: ${message}`);
            this.logger.error(`   Data:`, JSON.stringify(data, null, 2));
            this.logger.error(`   URL: ${error.config?.baseURL}${error.config?.url}`);

            if (status === 400) {
                throw new BadRequestException(`Dados inválidos: ${message}`);
            }

            if (status === 404) {
                throw new BadRequestException(
                    `Endpoint não encontrado. URL: ${error.config?.baseURL}${error.config?.url}`,
                );
            }

            throw new InternalServerErrorException(
                `Erro ao criar callback: ${message}`,
            );
        }
    }

    /**
     * ✏️ Atualizar callback (mesmo que criar na Inter - usa PUT)
     */
    async updateCallback(
        tipoWebhook: string,
        dto: UpdateWebhookCallbackDto,
    ): Promise<any> {
        this.logger.log(`✏️ Atualizando callback ${tipoWebhook}: ${dto.webhookUrl}`);

        // ✅ Na Inter, PUT serve tanto para criar quanto atualizar
        return this.createCallback(tipoWebhook, dto);
    }

    /**
     * 🗑️ Excluir callback
     */
    async deleteCallback(tipoWebhook: string): Promise<any> {
        this.logger.log(`🗑️ Excluindo callback: ${tipoWebhook}`);

        try {
            const axios = this.authService.getAxiosInstance();

            if (tipoWebhook === 'pix') {
                const pixKey = this.configService.get<string>('INTER_PIX_KEY');
                if (!pixKey) {
                    throw new BadRequestException('INTER_PIX_KEY não configurada');
                }
                const contaCorrente = this.configService.get<string>('INTER_CONTA_CORRENTE');

                await axios.delete(`/pix/v2/webhook/${encodeURIComponent(pixKey)}`, {
                    headers: {
                        'x-conta-corrente': contaCorrente,
                    },
                });

                this.logger.log(`✅ Webhook Pix excluído`);
                return { success: true, message: 'Webhook excluído' };
            }

            if (tipoWebhook === 'boletos') {
                await axios.delete(`/banking/v2/webhooks/boletos`);
                return { success: true, message: 'Webhook excluído' };
            }

            throw new BadRequestException('Tipo inválido');
        } catch (error: any) {
            const message = error.response?.data?.message || error.message;
            this.logger.error('❌ Erro ao excluir callback:', message);
            throw new BadRequestException(`Erro ao excluir callback: ${message}`);
        }
    }

    // ==================== VALIDAÇÃO DE ASSINATURA ====================

    /**
     * 🔐 Validar assinatura HMAC SHA256 do webhook
     */
    async validateWebhookSignature(
        payload: any,
        signature: string,
    ): Promise<boolean> {
        const secret = this.configService.get<string>('INTER_WEBHOOK_SECRET');

        if (!secret) {
            this.logger.warn('⚠️ INTER_WEBHOOK_SECRET não configurado, pulando validação');
            return true;
        }

        try {
            const payloadString = JSON.stringify(payload);
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(payloadString);
            const expectedSignature = hmac.digest('hex');

            const isValid = signature === expectedSignature;

            if (!isValid) {
                this.logger.error('❌ Assinatura inválida!');
                this.logger.debug('Esperado:', expectedSignature);
                this.logger.debug('Recebido:', signature);
            }

            return isValid;
        } catch (error: any) {
            this.logger.error('❌ Erro ao validar assinatura:', error.message);
            return false;
        }
    }

    // ==================== PROCESSAR WEBHOOKS ====================

    /**
     * 💰 Processar Pix recebido
     * - Identifica customer pelo txid (se começar com 'otsem')
     * - Credita automaticamente na conta do customer
     * - Cria Transaction de PIX_IN (modelo unificado)
     */
    async handlePixReceived(payload: any): Promise<void> {
        this.logger.log('💰 Processando Pix recebido...');
        this.logger.debug('Payload:', JSON.stringify(payload, null, 2));

        const pixList = payload.pix || [];

        if (!Array.isArray(pixList) || pixList.length === 0) {
            this.logger.warn('⚠️ Nenhum Pix encontrado no payload');
            return;
        }

        for (const pix of pixList) {
            try {
                const endToEnd = pix.endToEndId || pix.e2eId;
                const txid = pix.txid;
                const valorReais = parseFloat(pix.valor) || 0;
                const chave = pix.chave;

                if (!endToEnd) {
                    this.logger.warn('⚠️ Pix sem endToEndId, ignorando');
                    continue;
                }

                // ✅ Verificar se já processamos este endToEnd
                const existingTx = await this.prisma.transaction.findFirst({
                    where: { endToEnd },
                });

                if (existingTx) {
                    this.logger.warn(`⚠️ Pix duplicado: ${endToEnd}`);
                    await this.prisma.webhookLog.create({
                        data: {
                            source: 'INTER',
                            type: 'pix_received',
                            payload: pix as Prisma.InputJsonValue,
                            endToEnd,
                            txid,
                            processed: true,
                            error: 'Duplicado - ignorado',
                        },
                    });
                    continue;
                }

                // ✅ Buscar Transaction PENDING pelo txid (criado quando gerou QR Code)
                let pendingTx: any = null;
                if (txid) {
                    pendingTx = await this.prisma.transaction.findFirst({
                        where: { txid },
                        include: { account: { include: { customer: true } } },
                    });
                }

                if (pendingTx && pendingTx.status === 'PENDING' && pendingTx.accountId) {
                    // ✅ CASO 1: QR Code com customer vinculado - crédito automático
                    const txAccount = pendingTx.account;
                    const customerId = txAccount?.customerId;
                    this.logger.log(`✅ Transaction PENDING encontrada para txid ${txid} | Customer: ${customerId}`);

                    // Verificar se valor pago corresponde ao solicitado (0 = valor aberto, aceita qualquer valor)
                    const valorSolicitado = parseFloat(pendingTx.amount.toString());
                    const isValorAberto = valorSolicitado === 0;
                    
                    if (!isValorAberto && Math.abs(valorReais - valorSolicitado) > 0.01) {
                        this.logger.warn(`⚠️ Valor diferente! Solicitado: R$ ${valorSolicitado} | Pago: R$ ${valorReais}`);
                        // Atualizar transaction como erro para revisão manual
                        await this.prisma.$transaction([
                            this.prisma.transaction.update({
                                where: { id: pendingTx.id },
                                data: {
                                    endToEnd,
                                    amount: valorReais,
                                    payerName: pix.pagador?.nome,
                                    payerTaxNumber: pix.pagador?.cpfCnpj || pix.pagador?.cpf || pix.pagador?.cnpj,
                                    payerMessage: pix.infoPagador,
                                    pixKey: chave,
                                    status: 'PENDING',
                                    errorMessage: `Valor diferente: solicitado R$ ${valorSolicitado}, pago R$ ${valorReais}`,
                                    bankPayload: pix as Prisma.InputJsonValue,
                                    processedAt: new Date(),
                                },
                            }),
                            this.prisma.webhookLog.create({
                                data: {
                                    source: 'INTER',
                                    type: 'pix_received',
                                    payload: pix as Prisma.InputJsonValue,
                                    endToEnd,
                                    txid,
                                    processed: true,
                                    error: `Valor diferente: solicitado R$ ${valorSolicitado}, pago R$ ${valorReais}`,
                                    processedAt: new Date(),
                                },
                            }),
                        ]);
                        this.logger.log(`📝 Pix salvo como PENDING (valor diferente) para revisão manual: ${endToEnd}`);
                        continue;
                    }

                    const valorDecimal = new Prisma.Decimal(valorReais);
                    const balanceBefore = txAccount.balance;
                    const balanceAfter = balanceBefore.add(valorDecimal);

                    await this.prisma.$transaction([
                        // Atualizar Transaction para COMPLETED
                        this.prisma.transaction.update({
                            where: { id: pendingTx.id },
                            data: {
                                endToEnd,
                                amount: valorDecimal,
                                balanceBefore,
                                balanceAfter,
                                payerName: pix.pagador?.nome,
                                payerTaxNumber: pix.pagador?.cpfCnpj || pix.pagador?.cpf || pix.pagador?.cnpj,
                                payerMessage: pix.infoPagador,
                                pixKey: chave,
                                status: 'COMPLETED',
                                bankPayload: pix as Prisma.InputJsonValue,
                                processedAt: new Date(),
                                completedAt: new Date(),
                            },
                        }),
                        // Creditar na conta
                        this.prisma.account.update({
                            where: { id: txAccount.id },
                            data: { balance: balanceAfter },
                        }),
                        // Log do webhook
                        this.prisma.webhookLog.create({
                            data: {
                                source: 'INTER',
                                type: 'pix_received',
                                payload: pix as Prisma.InputJsonValue,
                                endToEnd,
                                txid,
                                processed: true,
                                processedAt: new Date(),
                            },
                        }),
                    ]);

                    this.logger.log(`✅ Pix creditado automaticamente: ${endToEnd} | R$ ${valorReais} | Customer: ${customerId}`);
                } else {
                    // ✅ CASO 2: Pix sem QR Code vinculado - criar Transaction PENDING para revisão manual
                    this.logger.log(`⚠️ Pix sem customer vinculado: ${endToEnd} | txid: ${txid}`);

                    // Precisamos de uma conta para associar - usar conta administrativa ou criar log
                    await this.prisma.webhookLog.create({
                        data: {
                            source: 'INTER',
                            type: 'pix_received_unlinked',
                            payload: pix as Prisma.InputJsonValue,
                            endToEnd,
                            txid,
                            processed: true,
                            error: 'Pix sem customer vinculado - requer revisão manual',
                            processedAt: new Date(),
                        },
                    });

                    this.logger.log(`📝 Pix salvo em webhook_logs (sem customer): ${endToEnd} | R$ ${valorReais}`);
                }
            } catch (error: any) {
                this.logger.error('❌ Erro ao processar Pix:', error.message);

                await this.prisma.webhookLog.create({
                    data: {
                        source: 'INTER',
                        type: 'pix_received',
                        payload: pix as Prisma.InputJsonValue,
                        endToEnd: pix.endToEndId || pix.e2eId,
                        txid: pix.txid,
                        processed: false,
                        error: error.message,
                    },
                });
            }
        }
    }

    /**
     * 📄 Processar Boleto recebido
     */
    async handleBoletoReceived(payload: any): Promise<void> {
        this.logger.log('📄 Processando Boleto recebido...');
        this.logger.debug('Payload:', JSON.stringify(payload, null, 2));

        await this.prisma.webhookLog.create({
            data: {
                source: 'INTER',
                type: 'boleto_received',
                payload: payload as Prisma.InputJsonValue,
                processed: true,
                processedAt: new Date(),
            },
        });

        this.logger.log('✅ Boleto registrado nos logs');
    }

    /**
     * 🧪 Testar webhook manualmente
     */
    async testWebhook(tipoWebhook: string): Promise<any> {
        this.logger.log(`🧪 Testando webhook: ${tipoWebhook}`);

        if (tipoWebhook === 'pix') {
            const mockPayload = {
                pix: [
                    {
                        endToEndId: `E${Date.now()}TEST`,
                        txid: `TEST-${Date.now()}`,
                        valor: 100.5,
                        horario: new Date().toISOString(),
                        pagador: {
                            cpf: '12345678900',
                            nome: 'João da Silva Teste',
                        },
                        infoPagador: 'Teste de webhook manual',
                    },
                ],
            };

            await this.handlePixReceived(mockPayload);

            return {
                success: true,
                message: 'Webhook Pix de teste processado',
                payload: mockPayload,
            };
        }

        if (tipoWebhook === 'boletos') {
            const mockPayload = {
                dataHoraSolicitacao: new Date().toISOString(),
                codigoSolicitacao: `TEST-${Date.now()}`,
                nossoNumero: '123456789',
                valorPago: 150.75,
            };

            await this.handleBoletoReceived(mockPayload);

            return {
                success: true,
                message: 'Webhook Boleto de teste processado',
                payload: mockPayload,
            };
        }

        throw new BadRequestException(
            'Tipo de webhook inválido. Use: pix ou boletos',
        );
    }
}