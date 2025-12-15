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
import { Prisma, TransactionType } from '@prisma/client';
import { SendPixDto, PixPaymentResponseDto } from '../dto/send-pix.dto';
import { CreatePixChargeDto } from '../dto/create-pix-charge.dto';
import { CreateStaticQrCodeDto } from '../dto/create-static-qrcode.dto';

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
     * 🔑 Gerar txid único para identificar customer
     * Formato: otsem + customerId curto + timestamp
     * Max 35 caracteres alfanuméricos (exigência do PIX)
     */
    private generateTxid(customerId?: string): string {
        // Inter exige: [A-Z0-9]{26,35} - maiúsculas e números, 26-35 caracteres
        const timestamp = Date.now().toString(36).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        if (customerId) {
            // Remove caracteres não alfanuméricos e pega os primeiros 12
            const shortId = customerId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toUpperCase();
            const txid = `OTSEM${shortId}${timestamp}${randomPart}`;
            // Garantir entre 26 e 35 caracteres
            return txid.substring(0, 35).padEnd(26, 'X');
        }
        
        const random = Math.random().toString(36).substring(2, 14).toUpperCase();
        const txid = `OTSEM${random}${timestamp}${randomPart}`;
        return txid.substring(0, 35).padEnd(26, 'X');
    }

    /**
     * 📱 Criar cobrança Pix (QR Code) para depósito
     * - Gera txid único vinculado ao customer
     * - Cria Deposit PENDING no banco
     * - Quando webhook chegar, identifica customer pelo txid e credita automaticamente
     */
    async createCobranca(dto: CreatePixChargeDto, customerId?: string): Promise<any> {
        this.logger.log(`📱 Criando cobrança Pix ${dto.valor ? `de R$ ${dto.valor}` : '(valor aberto)'} para customer: ${customerId || 'não informado'}...`);

        const { chave } = this.getMainPixKey();
        const txid = this.generateTxid(customerId);

        // Buscar nome do customer para usar na descrição
        let customerName = 'Cliente OTSEM';
        if (customerId) {
            const customer = await this.prisma.customer.findUnique({
                where: { id: customerId },
                select: { name: true },
            });
            if (customer?.name) {
                customerName = customer.name;
            }
        }

        try {
            const axios = this.authService.getAxiosInstance();
            
            // Payload base
            const payload: any = {
                calendario: {
                    expiracao: dto.expiracao || 3600,
                },
                chave,
                solicitacaoPagador: dto.descricao || `Depósito para ${customerName}`,
            };
            
            // Adicionar valor apenas se informado (QR Code com valor fixo)
            if (dto.valor) {
                payload.valor = {
                    original: dto.valor.toFixed(2),
                };
            }
            
            const response = await axios.put(`/pix/v2/cob/${txid}`, payload);

            const cobData = response.data;
            this.logger.log(`✅ Cobrança criada: ${cobData.txid}`);

            if (customerId) {
                // Valor em centavos (0 se valor aberto)
                const valorCentavos = dto.valor ? Math.round(dto.valor * 100) : 0;
                await this.prisma.deposit.create({
                    data: {
                        endToEnd: `PENDING-${txid}`,
                        receiptValue: valorCentavos,
                        receiptDate: new Date(),
                        status: 'PENDING',
                        customerId,
                        externalId: txid,
                        bankPayload: cobData as Prisma.InputJsonValue,
                    },
                });
                this.logger.log(`📝 Deposit PENDING criado para customer ${customerId} | txid: ${txid} | valor: ${valorCentavos === 0 ? 'aberto' : valorCentavos}`);
            }

            return {
                ...cobData,
                customerId,
                message: customerId 
                    ? 'Cobrança criada. Quando paga, o valor será creditado automaticamente.' 
                    : 'Cobrança criada. Sem customer vinculado - crédito manual necessário.',
            };
        } catch (error: any) {
            const errorData = error.response?.data;
            const errorStatus = error.response?.status;
            this.logger.error(`❌ Erro ao criar cobrança (${errorStatus}):`, JSON.stringify(errorData, null, 2));
            this.logger.error(`❌ txid usado: ${txid} | chave: ${chave} | valor: ${dto.valor}`);
            
            // Inter retorna violações em um array
            let errorMessage = 'Cobrança inválida.';
            if (errorData?.violacoes && Array.isArray(errorData.violacoes)) {
                errorMessage = errorData.violacoes.map((v: any) => `${v.propriedade}: ${v.razao}`).join('; ');
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            } else if (errorData?.title) {
                errorMessage = errorData.title;
            } else if (errorData?.detail) {
                errorMessage = errorData.detail;
            } else if (typeof errorData === 'string') {
                errorMessage = errorData;
            }
            
            throw new BadRequestException(errorMessage);
        }
    }

    /**
     * 🔍 Consultar cobrança Pix pelo txid
     */
    async getCobranca(txid: string): Promise<any> {
        this.logger.log(`🔍 Consultando cobrança: ${txid}...`);

        try {
            const axios = this.authService.getAxiosInstance();
            const response = await axios.get(`/pix/v2/cob/${txid}`);

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

        if (!customerId) {
            throw new BadRequestException('customerId não informado');
        }

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

            const response = await axios.post('/banking/v2/pix', payload);

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
                type: TransactionType.PIX_OUT,
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
                type: TransactionType.PIX_OUT,
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
                    type: TransactionType.PIX_OUT,
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

            const now = new Date();
            const dataInicio = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);
            const dataFim = now.toISOString().slice(0, 10);

            const response = await axios.get('/banking/v2/extrato/completo', {
                timeout: 10000,
                params: {
                    dataInicio,
                    dataFim,
                    pagina: 0,
                    tamanhoPagina: 50,
                    tipoOperacao: 'C',
                    tipoTransacao: 'PIX',
                },
                headers: {
                    'x-conta-corrente': '421136545',
                },
            });

            const pixList = response.data.transacoes || [];
            if (!Array.isArray(pixList) || pixList.length === 0) {
                this.logger.log('ℹ️ Nenhum Pix recebido encontrado.');
                return;
            }

            for (const pix of pixList) {
                const detalhes = pix.detalhes || {};
                const e2eId = detalhes.endToEndId;
                const chave = detalhes.chavePixRecebedor;
                const valor = Number(pix.valor);

                if (!e2eId || !chave || !valor) {
                    this.logger.warn(`⚠️ Pix inválido ou incompleto: ${JSON.stringify(pix)}`);
                    continue;
                }

                const alreadyProcessed = await this.prisma.payment.findFirst({
                    where: { endToEnd: e2eId },
                });
                if (alreadyProcessed) {
                    this.logger.warn(`🔁 Pix já processado: ${e2eId}`);
                    continue;
                }

                const customer = await this.prisma.customer.findFirst({
                    where: {
                        OR: [
                            { mainPixKey: chave },
                            {
                                pixKeys: {
                                    some: { keyValue: chave },
                                },
                            },
                        ],
                    },
                });

                if (!customer) {
                    this.logger.warn(`⚠️ Customer não encontrado para chave Pix: ${chave} | txid: ${detalhes.txId}`);
                    continue;
                }

                const account = await this.prisma.account.findUnique({
                    where: { customerId: customer.id },
                });
                if (!account) {
                    this.logger.warn(`⚠️ Conta não encontrada para o customer: ${customer.id}`);
                    continue;
                }

                await this.prisma.payment.create({
                    data: {
                        endToEnd: e2eId,
                        paymentValue: Math.round(valor * 100),
                        paymentDate: new Date(pix.dataInclusao),
                        receiverName: customer.name,
                        receiverPixKey: chave,
                        status: 'CONFIRMED',
                        bankPayload: pix as any,
                        customerId: customer.id,
                    },
                });

                await this.prisma.account.update({
                    where: { customerId: customer.id },
                    data: {
                        balance: {
                            increment: valor,
                        },
                    },
                });

                this.logger.log(`✅ Pix recebido salvo: ${e2eId} | Customer: ${customer.id}`);
            }
        } catch (error: any) {
            this.logger.error('❌ Erro ao buscar/processar Pix recebidos:', error.message);
            if (error.response) {
                this.logger.error('Detalhes:', JSON.stringify(error.response.data));
            }
        }
    }

    // ==================== QR CODE DE LONGA DURAÇÃO ====================

    /**
     * 📱 Gerar QR Code de Longa Duração via API Inter
     * - Usa cobrança dinâmica do Inter com expiração de 1 ano
     * - Retorna pixCopiaECola validado pelo Inter
     * - Pode receber um único pagamento (comportamento do QR dinâmico)
     */
    async createStaticQrCode(dto: CreateStaticQrCodeDto, customerId?: string): Promise<any> {
        this.logger.log(`📱 Gerando QR Code de longa duração ${dto.valor ? `de R$ ${dto.valor}` : '(valor aberto)'}...`);

        const { chave } = this.getMainPixKey();
        const txid = this.generateTxid(customerId);

        // Buscar nome do customer para usar na descrição
        let customerName = 'Cliente OTSEM';
        if (customerId) {
            const customer = await this.prisma.customer.findUnique({
                where: { id: customerId },
                select: { name: true },
            });
            if (customer?.name) {
                customerName = customer.name;
            }
        }

        try {
            const axios = this.authService.getAxiosInstance();
            
            // Payload com expiração de 1 ano (31536000 segundos)
            const payload: any = {
                calendario: {
                    expiracao: 31536000, // 1 ano em segundos
                },
                chave,
                solicitacaoPagador: dto.descricao || `Pagamento ${customerName}`,
            };
            
            // Adicionar valor apenas se informado
            if (dto.valor) {
                payload.valor = {
                    original: dto.valor.toFixed(2),
                };
            }
            
            const response = await axios.put(`/pix/v2/cob/${txid}`, payload);
            const cobData = response.data;
            
            this.logger.log(`✅ QR Code de longa duração criado: ${cobData.txid}`);

            // Criar deposit se tiver customer
            if (customerId) {
                const valorCentavos = dto.valor ? Math.round(dto.valor * 100) : 0;
                await this.prisma.deposit.create({
                    data: {
                        endToEnd: `PENDING-${txid}`,
                        receiptValue: valorCentavos,
                        receiptDate: new Date(),
                        status: 'PENDING',
                        customerId,
                        externalId: txid,
                        bankPayload: cobData as Prisma.InputJsonValue,
                    },
                });
                this.logger.log(`📝 Deposit PENDING criado | txid: ${txid}`);
            }

            return {
                txid: cobData.txid,
                chave,
                valor: dto.valor || null,
                valorAberto: !dto.valor,
                descricao: dto.descricao || `Pagamento ${customerName}`,
                identificador: dto.identificador || null,
                pixCopiaECola: cobData.pixCopiaECola,
                expiracao: '1 ano',
                status: cobData.status,
                message: 'QR Code gerado via Inter com validade de 1 ano.',
            };
        } catch (error: any) {
            this.logger.error('❌ Erro ao criar QR Code via Inter:', error.message);
            if (error.response) {
                this.logger.error('Detalhes:', JSON.stringify(error.response.data));
            }
            throw error;
        }
    }

    /**
     * 🔧 Gerar payload EMV (BRCode) para QR Code estático
     * Segue especificação do Banco Central do Brasil
     * Referência: https://github.com/renatomb/php_qrcode_pix
     */
    private generateEmvPayload(params: {
        chave: string;
        merchantName: string;
        merchantCity: string;
        valor?: number;
        txid?: string;
        infoAdicional?: string;
    }): string {
        const { chave, merchantName, merchantCity, valor, txid } = params;

        // Função auxiliar para formatar TLV (Tag-Length-Value)
        const tlv = (id: number, value: string): string => {
            const idStr = id.toString().padStart(2, '0');
            const length = value.length.toString().padStart(2, '0');
            return `${idStr}${length}${value}`;
        };

        // Remover acentos e caracteres especiais (exigido pelo padrão EMV)
        const sanitize = (str: string): string => {
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/[^A-Za-z0-9 ]/g, ''); // Mantém apenas alfanuméricos e espaços
        };

        // Montar Merchant Account Information (ID 26) - GUI + chave
        const gui = tlv(0, 'br.gov.bcb.pix'); // GUI em minúsculas conforme padrão
        const chavePix = tlv(1, chave.toLowerCase()); // Chave EVP em minúsculas
        const merchantAccountInfo = gui + chavePix;

        // Montar payload base
        let payload = '';
        payload += tlv(0, '01'); // Payload Format Indicator
        payload += tlv(26, merchantAccountInfo); // Merchant Account Information
        payload += tlv(52, '0000'); // Merchant Category Code
        payload += tlv(53, '986'); // Transaction Currency (BRL)
        
        if (valor && valor > 0) {
            payload += tlv(54, valor.toFixed(2)); // Transaction Amount
        }
        
        payload += tlv(58, 'BR'); // Country Code
        payload += tlv(59, sanitize(merchantName).toUpperCase().substring(0, 25)); // Merchant Name (max 25)
        payload += tlv(60, sanitize(merchantCity).toUpperCase().substring(0, 15)); // Merchant City (max 15)
        
        // Additional Data Field Template (ID 62) com txid ou ***
        const referenceLabel = txid ? txid.substring(0, 25) : '***';
        const additionalData = tlv(5, referenceLabel); // Reference Label (subcampo 05)
        payload += tlv(62, additionalData);

        // CRC16 (ID 63) - adicionar "6304" antes de calcular
        payload += '6304';
        const crc = this.calculateCRC16(payload);

        return payload + crc;
    }

    /**
     * 🔢 Calcular CRC16-CCITT-FALSE para validação do BRCode
     * Implementação baseada na referência do Banco Central
     */
    private calculateCRC16(str: string): string {
        let crc = 0xFFFF;

        for (let c = 0; c < str.length; c++) {
            crc ^= str.charCodeAt(c) << 8;
            for (let i = 0; i < 8; i++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc = crc << 1;
                }
            }
        }

        const hex = crc & 0xFFFF;
        return hex.toString(16).toUpperCase().padStart(4, '0');
    }
}