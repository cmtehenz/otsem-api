// src/inter/controllers/inter-test.controller.ts

import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterAuthService } from '../services/inter-auth.service';
import { InterBankingService } from '../services/inter-banking.service';
import { InterPixService } from '../services/inter-pix.service';
import { InterPixKeysService } from '../services/inter-pix-keys.service';

@ApiTags('Inter - Testes')
@ApiBearerAuth()
@Controller('inter/test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InterTestController {
    constructor(
        private readonly authService: InterAuthService,
        private readonly bankingService: InterBankingService,
        private readonly pixService: InterPixService,
        private readonly pixKeysService: InterPixKeysService,
    ) { }

    @Get('auth')
    @ApiOperation({ summary: '🔐 Testar autenticação OAuth 2.0 (Admin)' })
    async testAuth() {
        try {
            const token = await this.authService.getToken();

            return {
                success: true,
                message: '✅ Autenticação funcionando',
                tokenPreview: `${token.substring(0, 20)}...${token.substring(token.length - 20)}`,
                tokenLength: token.length,
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Erro na autenticação',
                error: error.message,
            };
        }
    }

    @Get('saldo')
    @ApiOperation({ summary: '💰 Testar consulta de saldo (Admin)' })
    async testSaldo() {
        try {
            const saldo = await this.bankingService.getSaldo();

            return {
                success: true,
                message: '✅ Consulta de saldo funcionando',
                data: saldo,
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Erro ao consultar saldo',
                error: error.response?.data || error.message,
            };
        }
    }

    @Get('extrato')
    @ApiOperation({ summary: '📊 Testar consulta de extrato (Admin)' })
    async testExtrato() {
        try {
            const extrato = await this.bankingService.getExtratoUltimosDias(7);

            return {
                success: true,
                message: '✅ Consulta de extrato funcionando',
                totalTransacoes: extrato.transacoes?.length || 0,
                data: extrato,
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Erro ao consultar extrato',
                error: error.response?.data || error.message,
            };
        }
    }

    @Get('pix/chaves')
    @ApiOperation({ summary: '🔑 Testar listagem de chaves Pix (Admin)' })
    async testPixKeys() {
        try {
            const chaves = await this.pixKeysService.listKeys();

            return {
                success: true,
                message: '✅ Listagem de chaves Pix funcionando',
                totalChaves: chaves.length,
                data: chaves,
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Erro ao listar chaves Pix',
                error: error.response?.data || error.message,
            };
        }
    }

    @Post('pix/chave-teste')
    @ApiOperation({ summary: '🔑 Criar chave Pix aleatória de teste (Admin)' })
    async testCreatePixKey() {
        try {
            const axios = this.authService.getAxiosInstance();

            const response = await axios.post('/banking/v2/pix/chaves', {
                tipoChave: 'ALEATORIA',
            });

            return {
                success: true,
                message: '✅ Chave Pix criada com sucesso',
                data: response.data,
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Erro ao criar chave Pix',
                error: error.response?.data || error.message,
            };
        }
    }

    @Get('connection')
    @ApiOperation({ summary: '🌐 Testar conexão geral com API Inter (Admin)' })
    async testConnection() {
        const results = {
            auth: { success: false, error: null },
            saldo: { success: false, error: null },
            extrato: { success: false, error: null },
            pixKeys: { success: false, error: null },
        };

        // Teste 1: Autenticação
        try {
            await this.authService.getToken();
            results.auth.success = true;
        } catch (error) {
            results.auth.error = error.message;
        }

        // Teste 2: Saldo
        try {
            await this.bankingService.getSaldo();
            results.saldo.success = true;
        } catch (error) {
            results.saldo.error = error.response?.data?.mensagem || error.message;
        }

        // Teste 3: Extrato
        try {
            await this.bankingService.getExtratoUltimosDias(7);
            results.extrato.success = true;
        } catch (error) {
            results.extrato.error = error.response?.data?.mensagem || error.message;
        }

        // Teste 4: Chaves Pix
        try {
            await this.pixKeysService.listKeys();
            results.pixKeys.success = true;
        } catch (error) {
            results.pixKeys.error = error.response?.data?.mensagem || error.message;
        }

        const totalSuccess = Object.values(results).filter(r => r.success).length;
        const totalTests = Object.keys(results).length;

        return {
            summary: `${totalSuccess}/${totalTests} testes passaram`,
            allTestsPassed: totalSuccess === totalTests,
            results,
        };
    }

    @Get('health')
    @ApiOperation({ summary: '❤️ Health check da integração Inter (Admin)' })
    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            service: 'Banco Inter API',
            status: 'unknown',
            details: {
                auth: 'unknown',
                api: 'unknown',
                certificates: 'unknown',
            },
        };

        try {
            // Verificar autenticação
            await this.authService.getToken();
            health.details.auth = 'ok';
            health.details.certificates = 'ok';

            // Verificar API
            await this.bankingService.getSaldo();
            health.details.api = 'ok';

            health.status = 'healthy';
        } catch (error) {
            health.status = 'unhealthy';

            if (error.message.includes('Certificados')) {
                health.details.certificates = 'error';
            }

            if (error.message.includes('autenticação')) {
                health.details.auth = 'error';
            } else {
                health.details.api = 'error';
            }
        }

        return health;
    }

    @Get('token-info')
    @ApiOperation({ summary: '🔍 Verificar informações do token OAuth (Admin)' })
    async getTokenInfo() {
        try {
            const token = await this.authService.getToken();

            // Decodificar JWT (sem validar assinatura, apenas para debug)
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Token inválido');
            }

            const payload = JSON.parse(
                Buffer.from(parts[1], 'base64').toString('utf8')
            );

            return {
                success: true,
                message: '✅ Token obtido com sucesso',
                data: {
                    clientId: payload.client_id,
                    scopes: payload.scope || 'N/A',
                    expiresIn: payload.exp
                        ? new Date(payload.exp * 1000).toISOString()
                        : 'N/A',
                    issuedAt: payload.iat
                        ? new Date(payload.iat * 1000).toISOString()
                        : 'N/A',
                },
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Erro ao obter token',
                error: error.message,
            };
        }
    }
}