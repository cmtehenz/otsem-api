// src/inter/services/inter-banking.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InterAuthService } from './inter-auth.service';
import { InterSaldoResponse, InterExtratoResponse } from '../types/inter.types';

@Injectable()
export class InterBankingService {
    private readonly logger = new Logger(InterBankingService.name);

    constructor(private readonly authService: InterAuthService) { }

    /**
     * Consultar saldo da conta Inter
     */
    async getSaldo(): Promise<InterSaldoResponse> {
        this.logger.log('💰 Consultando saldo...');

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get<InterSaldoResponse>('/banking/v2/saldo');

            this.logger.log(`✅ Saldo: R$ ${response.data.disponivel}`);
            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao consultar saldo:', error.response?.data);
            throw error;
        }
    }

    /**
     * Consultar extrato
     */
    async getExtrato(
        dataInicio: string,
        dataFim: string
    ): Promise<InterExtratoResponse> {
        this.logger.log(`📊 Consultando extrato de ${dataInicio} até ${dataFim}...`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get<InterExtratoResponse>(
                '/banking/v2/extrato',
                {
                    params: { dataInicio, dataFim },
                }
            );

            const total = response.data.transacoes?.length || 0;
            this.logger.log(`✅ Extrato: ${total} transações encontradas`);

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao consultar extrato:', error.response?.data);
            throw error;
        }
    }

    /**
     * Consultar extrato dos últimos N dias
     */
    async getExtratoUltimosDias(dias = 30): Promise<InterExtratoResponse> {
        const dataFim = new Date();
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - dias);

        return this.getExtrato(
            dataInicio.toISOString().split('T')[0],
            dataFim.toISOString().split('T')[0]
        );
    }
}