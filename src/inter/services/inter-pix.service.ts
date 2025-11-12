// src/inter/services/inter-pix.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InterAuthService } from './inter-auth.service';
import {
    InterChavesPixResponse,
    InterCobrancaPix,
} from '../types/inter.types';
import { CreatePixChargeDto } from '../dto/create-pix-charge.dto';
import { SendPixDto } from '../dto/send-pix.dto';

@Injectable()
export class InterPixService {
    private readonly logger = new Logger(InterPixService.name);

    constructor(private readonly authService: InterAuthService) { }

    /**
     * Listar chaves Pix cadastradas
     */
    async getChaves(): Promise<InterChavesPixResponse> {
        this.logger.log('🔑 Listando chaves Pix...');

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get<InterChavesPixResponse>(
                '/banking/v2/pix/chaves'
            );

            const total = response.data.chaves?.length || 0;
            this.logger.log(`✅ ${total} chaves Pix encontradas`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao listar chaves Pix:', error.response?.data);
            throw error;
        }
    }

    /**
     * Criar cobrança Pix (QR Code)
     */
    async createCobranca(dto: CreatePixChargeDto): Promise<InterCobrancaPix> {
        this.logger.log(`📱 Criando cobrança Pix de R$ ${dto.valor}...`);

        try {
            // Obter primeira chave Pix disponível
            const chaves = await this.getChaves();

            if (!chaves.chaves || chaves.chaves.length === 0) {
                throw new BadRequestException(
                    'Nenhuma chave Pix cadastrada. Configure no portal Inter.'
                );
            }

            const chavePix = chaves.chaves[0].chave;

            const axios = this.authService.getAxiosInstance();
            const response = await axios.post<InterCobrancaPix>(
                '/banking/v2/pix/cobrancas',
                {
                    calendario: {
                        expiracao: dto.expiracao || 3600, // 1 hora padrão
                    },
                    valor: {
                        original: dto.valor.toFixed(2),
                    },
                    chave: chavePix,
                    solicitacaoPagador: dto.descricao || 'Cobrança OTSEM Bank',
                }
            );

            this.logger.log(`✅ Cobrança criada: ${response.data.txid}`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao criar cobrança:', error.response?.data);
            throw error;
        }
    }

    /**
     * Consultar cobrança Pix pelo txid
     */
    async getCobranca(txid: string): Promise<InterCobrancaPix> {
        this.logger.log(`🔍 Consultando cobrança: ${txid}...`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get<InterCobrancaPix>(
                `/banking/v2/pix/cobrancas/${txid}`
            );

            this.logger.log(`✅ Status: ${response.data.status}`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao consultar cobrança:', error.response?.data);
            throw error;
        }
    }

    /**
     * Enviar Pix (pagamento)
     */
    async sendPix(dto: SendPixDto): Promise<any> {
        this.logger.log(`💸 Enviando Pix de R$ ${dto.valor}...`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.post('/banking/v2/pix/pagamentos', {
                valor: dto.valor.toFixed(2),
                chaveDestino: dto.chaveDestino,
                descricao: dto.descricao || 'Pagamento OTSEM Bank',
            });

            this.logger.log(`✅ Pix enviado com sucesso`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao enviar Pix:', error.response?.data);
            throw error;
        }
    }
}