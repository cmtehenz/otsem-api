import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PixKeyType, PixKeyStatus } from '@prisma/client';

@Injectable()
export class PixKeysService {
    private readonly logger = new Logger(PixKeysService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getKeysByCustomer(customerId: string) {
        return this.prisma.pixKey.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Salvar chave PIX do usuário com validação automática
     * Se a chave for CPF/CNPJ do próprio customer, marca como validated = true
     */
    async createPixKey(
        customerId: string,
        keyType: PixKeyType,
        keyValue: string,
    ) {
        this.logger.log(`🔑 Salvando chave PIX ${keyType}: ${keyValue} para customer ${customerId}`);

        // Buscar customer para validar CPF/CNPJ
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            select: { cpf: true, cnpj: true, name: true, email: true, phone: true },
        });

        if (!customer) {
            throw new BadRequestException('Cliente não encontrado');
        }

        // Verificar se a chave já existe para este customer
        const existingKey = await this.prisma.pixKey.findFirst({
            where: { customerId, keyValue },
        });

        if (existingKey) {
            throw new ConflictException('Esta chave PIX já está cadastrada');
        }

        // Validar formato da chave
        this.validatePixKeyFormat(keyType, keyValue);

        // Verificar se a chave pertence ao próprio CPF/CNPJ do customer
        const { validated, validationReason } = this.checkKeyOwnership(
            keyType,
            keyValue,
            customer,
        );

        const pixKey = await this.prisma.pixKey.create({
            data: {
                customerId,
                keyType,
                keyValue,
                status: PixKeyStatus.ACTIVE,
                validated,
                validatedAt: validated ? new Date() : null,
            },
        });

        this.logger.log(
            `✅ Chave PIX salva: ${keyValue} | validated: ${validated} | ${validationReason}`,
        );

        return {
            ...pixKey,
            validationReason,
        };
    }

    /**
     * Verificar se a chave pertence ao próprio customer
     */
    private checkKeyOwnership(
        keyType: PixKeyType,
        keyValue: string,
        customer: { cpf: string | null; cnpj: string | null; email: string | null; phone: string | null },
    ): { validated: boolean; validationReason: string } {
        const normalizedValue = keyValue.replace(/[.\-\/\s\+]/g, '').toLowerCase();

        switch (keyType) {
            case 'CPF': {
                const customerCpf = customer.cpf?.replace(/[.\-]/g, '') || '';
                if (normalizedValue === customerCpf) {
                    return { validated: true, validationReason: 'CPF corresponde ao cadastro do cliente' };
                }
                return { validated: false, validationReason: 'CPF não corresponde ao cadastro do cliente' };
            }

            case 'CNPJ': {
                const customerCnpj = customer.cnpj?.replace(/[.\-\/]/g, '') || '';
                if (normalizedValue === customerCnpj) {
                    return { validated: true, validationReason: 'CNPJ corresponde ao cadastro do cliente' };
                }
                return { validated: false, validationReason: 'CNPJ não corresponde ao cadastro do cliente' };
            }

            case 'EMAIL': {
                const customerEmail = customer.email?.toLowerCase() || '';
                if (keyValue.toLowerCase() === customerEmail) {
                    return { validated: true, validationReason: 'Email corresponde ao cadastro do cliente' };
                }
                return { validated: false, validationReason: 'Email não corresponde ao cadastro do cliente' };
            }

            case 'PHONE': {
                // Normaliza removendo +55 e caracteres especiais
                const normalizedPhone = normalizedValue.replace(/^55/, '');
                const customerPhone = customer.phone?.replace(/[.\-\s\+]/g, '').replace(/^55/, '') || '';
                if (normalizedPhone === customerPhone) {
                    return { validated: true, validationReason: 'Telefone corresponde ao cadastro do cliente' };
                }
                return { validated: false, validationReason: 'Telefone não corresponde ao cadastro do cliente' };
            }

            case 'RANDOM': {
                // Chave aleatória não pode ser validada automaticamente
                return { validated: false, validationReason: 'Chave aleatória requer validação manual' };
            }

            default:
                return { validated: false, validationReason: 'Tipo de chave não suportado para validação automática' };
        }
    }

    /**
     * Validar formato da chave PIX
     */
    private validatePixKeyFormat(keyType: PixKeyType, keyValue: string): void {
        const normalized = keyValue.replace(/[.\-\/\s]/g, '');

        switch (keyType) {
            case 'CPF':
                if (!/^\d{11}$/.test(normalized)) {
                    throw new BadRequestException('CPF inválido. Deve conter 11 dígitos');
                }
                break;

            case 'CNPJ':
                if (!/^\d{14}$/.test(normalized)) {
                    throw new BadRequestException('CNPJ inválido. Deve conter 14 dígitos');
                }
                break;

            case 'EMAIL':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(keyValue)) {
                    throw new BadRequestException('Email inválido');
                }
                break;

            case 'PHONE':
                // Aceita +5511999999999 ou 11999999999
                if (!/^(\+55)?\d{10,11}$/.test(normalized.replace(/^55/, ''))) {
                    throw new BadRequestException('Telefone inválido. Use formato: +5511999999999');
                }
                break;

            case 'RANDOM':
                // Chave aleatória tem formato UUID
                if (!/^[a-f0-9-]{32,36}$/i.test(keyValue)) {
                    throw new BadRequestException('Chave aleatória inválida');
                }
                break;
        }
    }

    /**
     * Atualizar chave existente
     */
    async updatePixKey(
        customerId: string,
        keyId: string,
        data: { status?: PixKeyStatus },
    ) {
        const pixKey = await this.prisma.pixKey.findFirst({
            where: { id: keyId, customerId },
        });

        if (!pixKey) {
            throw new BadRequestException('Chave PIX não encontrada');
        }

        return this.prisma.pixKey.update({
            where: { id: keyId },
            data,
        });
    }

    /**
     * Excluir chave PIX
     */
    async deletePixKey(customerId: string, keyId: string) {
        const pixKey = await this.prisma.pixKey.findFirst({
            where: { id: keyId, customerId },
        });

        if (!pixKey) {
            throw new BadRequestException('Chave PIX não encontrada');
        }

        await this.prisma.pixKey.delete({
            where: { id: keyId },
        });

        this.logger.log(`🗑️ Chave PIX excluída: ${pixKey.keyValue}`);

        return { message: 'Chave PIX excluída com sucesso' };
    }

    /**
     * Buscar chave validada do customer para envio de PIX
     */
    async getValidatedKeyForPix(customerId: string, keyValue: string): Promise<boolean> {
        const pixKey = await this.prisma.pixKey.findFirst({
            where: {
                customerId,
                keyValue,
                validated: true,
                status: 'ACTIVE',
            },
        });

        return !!pixKey;
    }
}
