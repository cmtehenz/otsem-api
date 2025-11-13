// src/inter/services/inter-banking.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InterAuthService } from './inter-auth.service';

@Injectable()
export class InterBankingService {
    private readonly logger = new Logger(InterBankingService.name);

    constructor(private readonly authService: InterAuthService) { }

    /**
     * 💰 Consultar saldo da conta
     */
    async getSaldo(): Promise<any> {
        this.logger.log('💰 Consultando saldo...');

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get('/banking/v2/saldo');

            this.logger.log('✅ Saldo consultado com sucesso');
            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Erro ao consultar saldo:', error.message);
            throw error;
        }
    }

    /**
     * 📊 Consultar extrato
     */
    async getExtrato(dataInicio: string, dataFim: string): Promise<any> {
        this.logger.log(`📊 Consultando extrato: ${dataInicio} a ${dataFim}`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get('/banking/v2/extrato', {
                params: { dataInicio, dataFim },
            });

            this.logger.log('✅ Extrato consultado');
            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Erro ao consultar extrato:', error.message);
            throw error;
        }
    }

    /**
     * 📊 Consultar extrato dos últimos N dias
     */
    async getExtratoUltimosDias(dias: number): Promise<any> {
        const dataFim = new Date();
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - dias);

        const formatDate = (date: Date): string => {
            return date.toISOString().split('T')[0];
        };

        return this.getExtrato(formatDate(dataInicio), formatDate(dataFim));
    }

    /**
     * 📊 Dashboard: Resumo bancário
     */
    async getDashboardData(): Promise<any> {
        this.logger.log('📊 Consultando dados do dashboard...');

        try {
            const saldo = await this.getSaldo().catch(() => null);
            const extrato = await this.getExtratoUltimosDias(30).catch(() => null);

            return {
                saldo,
                extrato,
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error('❌ Erro ao obter dashboard:', error.message);
            return {
                saldo: null,
                extrato: null,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * 📈 Estatísticas bancárias
     */
    async getEstatiticas(dias: number = 30): Promise<any> {
        this.logger.log(`📈 Calculando estatísticas dos últimos ${dias} dias`);

        try {
            const saldo = await this.getSaldo().catch(() => ({ disponivel: 0 }));
            const extrato = await this.getExtratoUltimosDias(dias).catch(() => ({
                transacoes: [],
            }));

            const transacoes = extrato.transacoes || [];

            return {
                periodo: {
                    dias,
                    dataInicio: new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString(),
                    dataFim: new Date().toISOString(),
                },
                saldo: saldo.disponivel || 0,
                transacoes: {
                    total: transacoes.length,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error('❌ Erro ao calcular estatísticas:', error.message);
            return {
                periodo: { dias },
                saldo: 0,
                transacoes: { total: 0 },
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}