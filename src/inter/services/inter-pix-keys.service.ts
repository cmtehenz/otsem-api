// src/inter/services/inter-pix-keys.service.ts

import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';
import { InterAuthService } from './inter-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
    InterPixKeyRequest,
    InterPixKeyResponse,
    InterPixKeyDeleteResponse,
} from '../types/inter.types';

/** Mapeia os nomes da API do Banco Inter para o enum PixKeyType */
const INTER_TO_PIX_KEY_TYPE: Record<string, PixKeyType> = {
    CPF: PixKeyType.CPF,
    CNPJ: PixKeyType.CNPJ,
    EMAIL: PixKeyType.EMAIL,
    TELEFONE: PixKeyType.PHONE,
};

@Injectable()
export class InterPixKeysService {
    private readonly logger = new Logger(InterPixKeysService.name);

    constructor(
        private readonly authService: InterAuthService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Cadastrar chave Pix aleatória (EVP)
     */
    async registerRandomKey(customerId: string): Promise<string> {
        this.logger.log(`🔑 Cadastrando chave Pix aleatória para customer ${customerId}`);

        try {
            const axios = this.authService.getAxiosInstance();

            // Cadastrar chave aleatória no Banco Inter
            const response = await axios.post<InterPixKeyResponse>(
                '/banking/v2/pix/chaves',
                {
                    tipoChave: 'ALEATORIA',
                },
            );

            const pixKey = response.data.chave;
            this.logger.log(`✅ Chave Pix criada: ${pixKey}`);

            // Salvar no banco de dados local
            await this.prisma.account.update({
                where: { customerId },
                data: {
                    pixKey,
                    pixKeyType: 'RANDOM',
                },
            });

            return pixKey;
        } catch (error) {
            this.logger.error('❌ Erro ao cadastrar chave Pix:', error.response?.data);

            if (error.response?.status === 409) {
                throw new ConflictException('Chave Pix já cadastrada');
            }

            throw error;
        }
    }

    /**
     * Cadastrar chave Pix específica (CPF, Email, Telefone)
     */
    async registerKey(
        customerId: string,
        tipoChave: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE',
        chave: string,
    ): Promise<InterPixKeyResponse> {
        this.logger.log(
            `🔑 Cadastrando chave Pix ${tipoChave}: ${chave} para customer ${customerId}`,
        );

        try {
            // Validar formato da chave
            this.validatePixKey(tipoChave, chave);

            const axios = this.authService.getAxiosInstance();

            // Cadastrar chave no Banco Inter
            const response = await axios.post<InterPixKeyResponse>(
                '/banking/v2/pix/chaves',
                {
                    tipoChave,
                    chave,
                },
            );

            this.logger.log(`✅ Chave Pix ${tipoChave} cadastrada: ${chave}`);

            // Atualizar no banco de dados local (se for a primeira chave)
            const account = await this.prisma.account.findUnique({
                where: { customerId },
            });

            if (!account?.pixKey) {
                await this.prisma.account.update({
                    where: { customerId },
                    data: {
                        pixKey: chave,
                        pixKeyType: INTER_TO_PIX_KEY_TYPE[tipoChave],
                    },
                });
            }

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao cadastrar chave Pix:', error.response?.data);

            if (error.response?.status === 409) {
                throw new ConflictException('Chave Pix já cadastrada por outro usuário');
            }

            if (error.response?.status === 400) {
                throw new BadRequestException(
                    error.response?.data?.mensagem || 'Formato de chave inválido',
                );
            }

            throw error;
        }
    }

    /**
     * Listar todas as chaves Pix cadastradas
     */
    async listKeys(): Promise<InterPixKeyResponse[]> {
        this.logger.log('🔑 Listando todas as chaves Pix...');

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get<{ chaves: InterPixKeyResponse[] }>(
                '/banking/v2/pix/chaves',
            );

            const total = response.data.chaves?.length || 0;
            this.logger.log(`✅ ${total} chaves Pix encontradas`);

            return response.data.chaves || [];
        } catch (error) {
            this.logger.error('❌ Erro ao listar chaves Pix:', error.response?.data);
            throw error;
        }
    }

    /**
     * Consultar chave Pix específica
     */
    async getKey(chave: string): Promise<InterPixKeyResponse> {
        this.logger.log(`🔍 Consultando chave Pix: ${chave}`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get<InterPixKeyResponse>(
                `/banking/v2/pix/chaves/${encodeURIComponent(chave)}`,
            );

            this.logger.log(`✅ Chave encontrada: ${response.data.chave}`);
            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao consultar chave Pix:', error.response?.data);

            if (error.response?.status === 404) {
                throw new BadRequestException('Chave Pix não encontrada');
            }

            throw error;
        }
    }

    /**
     * Excluir chave Pix
     */
    async deleteKey(chave: string): Promise<InterPixKeyDeleteResponse> {
        this.logger.log(`🗑️ Excluindo chave Pix: ${chave}`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.delete<InterPixKeyDeleteResponse>(
                `/banking/v2/pix/chaves/${encodeURIComponent(chave)}`,
            );

            this.logger.log(`✅ Chave Pix excluída: ${chave}`);

            // Remover do banco de dados local se for a chave principal
            await this.prisma.account.updateMany({
                where: { pixKey: chave },
                data: {
                    pixKey: undefined,
                    pixKeyType: undefined,
                },
            });

            return response.data;
        } catch (error) {
            this.logger.error('❌ Erro ao excluir chave Pix:', error.response?.data);

            if (error.response?.status === 404) {
                throw new BadRequestException('Chave Pix não encontrada');
            }

            throw error;
        }
    }

    /**
     * Validar formato da chave Pix
     */
    private validatePixKey(tipo: string, chave: string): void {
        switch (tipo) {
            case 'CPF':
                if (!/^\d{11}$/.test(chave.replace(/\D/g, ''))) {
                    throw new BadRequestException('CPF inválido. Use apenas números (11 dígitos)');
                }
                break;

            case 'CNPJ':
                if (!/^\d{14}$/.test(chave.replace(/\D/g, ''))) {
                    throw new BadRequestException('CNPJ inválido. Use apenas números (14 dígitos)');
                }
                break;

            case 'EMAIL':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) {
                    throw new BadRequestException('Email inválido');
                }
                break;

            case 'TELEFONE':
                // Formato: +5511999999999
                if (!/^\+55\d{2}\d{8,9}$/.test(chave.replace(/\D/g, '+55'))) {
                    throw new BadRequestException(
                        'Telefone inválido. Use formato: +5511999999999',
                    );
                }
                break;
        }
    }

    /**
     * Verificar se chave Pix está disponível
     */
    async isKeyAvailable(chave: string): Promise<boolean> {
        try {
            await this.getKey(chave);
            return false; // Chave já existe
        } catch (error) {
            if (error.response?.status === 404) {
                return true; // Chave disponível
            }
            throw error;
        }
    }
}