// src/inter/services/inter-webhook.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InterAuthService } from './inter-auth.service';
import { InterWebhook } from '../types/inter.types';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../../transactions/transactions.service';

@Injectable()
export class InterWebhookService {
    private readonly logger = new Logger(InterWebhookService.name);
    constructor(
        private readonly authService: InterAuthService,
        private readonly prisma: PrismaService,
        private readonly transactionsService: TransactionsService,
    ) { }

    /**
     * Listar webhooks cadastrados
     */
    async getWebhooks(): Promise<{ webhooks: InterWebhook[] }> {
        this.logger.log('🔔 Listando webhooks...');

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get('/banking/v2/webhooks');

            const total = response.data.webhooks?.length || 0;
            this.logger.log(`✅ ${total} webhooks cadastrados`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao listar webhooks:', error.response?.data);
            throw error;
        }
    }

    /**
     * Cadastrar webhook Pix
     */
    async createWebhookPix(webhookUrl: string): Promise<InterWebhook> {
        this.logger.log(`🔔 Cadastrando webhook Pix: ${webhookUrl}...`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.post('/banking/v2/webhooks/pix', {
                webhookUrl,
            });

            this.logger.log(`✅ Webhook Pix cadastrado`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao cadastrar webhook:', error.response?.data);
            throw error;
        }
    }

    /**
     * Processar notificação de Pix recebido
     */
    async handlePixReceived(payload: any): Promise<void> {
        this.logger.log('📥 Webhook Pix recebido do Banco Inter');

        try {
            // Salvar log
            await this.prisma.webhookLog.create({
                data: {
                    source: 'INTER',
                    type: 'pix_received',
                    payload,
                },
            });

            // Processar cada Pix
            for (const pix of payload.pix || []) {
                const { endToEndId, valor, chave, pagador, horario } = pix;

                this.logger.log(
                    `💰 Pix recebido: R$ ${valor} para chave ${chave} de ${pagador?.nome}`
                );

                // Processar depósito
                await this.transactionsService.processPixDeposit(
                    chave, // Chave Pix do customer
                    parseFloat(valor),
                    pagador,
                    endToEndId, // E2E ID como externalId
                );
            }

            this.logger.log('✅ Webhook processado');
        } catch (error) {
            this.logger.error('❌ Erro ao processar webhook:', error);
            throw error;
        }
    }
}