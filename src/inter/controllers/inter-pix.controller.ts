// src/inter/controllers/inter-pix.controller.ts

import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Request,
    Query,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { InterPixService } from '../services/inter-pix.service';
import { SendPixDto, PixPaymentResponseDto } from '../dto/send-pix.dto';
import { CreatePixChargeDto } from '../dto/create-pix-charge.dto';
import { CreateStaticQrCodeDto } from '../dto/create-static-qrcode.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterPixTesteService } from '../services/inter-pix-teste.service';
import type { PixTestePayload } from '../services/inter-pix-teste.service';

@ApiTags('💸 Pix (Inter)')
@ApiBearerAuth()
@Controller('inter/pix')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterPixController {
    constructor(
        private readonly pixService: InterPixService,
        private readonly pixTesteService: InterPixTesteService,
    ) { }

    // ==================== ENVIAR PIX ====================

    @Post('send-pix')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: '💸 Enviar Pix' })
    @ApiResponse({
        status: 201,
        description: 'Pix enviado com sucesso',
        type: PixPaymentResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Saldo insuficiente ou dados inválidos',
    })
    async sendPix(@Request() req: any, @Body() dto: SendPixDto) {
        const customerId = req.user?.customerId; // ou dto.customerId
        return this.pixService.sendPix(customerId, dto);
    }

    @Get('status/:endToEndId')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: '🔍 Consultar status de Pix enviado' })
    async getPixStatus(@Param('endToEndId') endToEndId: string) {
        return this.pixService.getPixStatus(endToEndId);
    }


    // ==================== COBRANÇAS (QR CODE) ====================

    @Post('cobrancas')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: '📱 Criar cobrança Pix (QR Code) para depósito' })
    @ApiResponse({
        status: 201,
        description: 'Cobrança criada com sucesso. O txid identifica o customer para crédito automático.',
    })
    async createCobranca(@Request() req: any, @Body() dto: CreatePixChargeDto) {
        const customerId = dto.customerId || req.user?.customerId;
        return this.pixService.createCobranca(dto, customerId);
    }

    @Get('cobrancas/:txid')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: '🔍 Consultar cobrança Pix' })
    async getCobranca(@Param('txid') txid: string) {
        return this.pixService.getCobranca(txid);
    }

    // ==================== QR CODE ESTÁTICO ====================

    @Post('qrcode-estatico')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ 
        summary: '📱 Gerar QR Code Estático (sem expiração)',
        description: 'Gera QR Code PIX estático que não expira e pode receber múltiplos pagamentos. Ideal para pontos de venda fixos.'
    })
    async createStaticQrCode(@Request() req: any, @Body() dto: CreateStaticQrCodeDto) {
        const customerId = req.user?.customerId;
        return this.pixService.createStaticQrCode(dto, customerId);
    }

    @Post('testar-envio')
    @ApiOperation({ summary: '🔬 Testar envio Pix (direto para Inter)' })
    async testarEnvioPix(@Body() body: PixTestePayload, @Query('idIdempotente') idIdempotente: string) {
        console.log('Controller - testarEnvioPix - body recebido:', body);
        return this.pixTesteService.testarEnvioPix({
            payload: body,
            idIdempotente,
        });
    }

    // ==================== RECONCILIAÇÃO ====================

    @Get('cobrancas')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '🔄 Listar cobranças PIX dos últimos N dias' })
    async listCobrancas(@Query('dias') dias?: string) {
        const numDias = dias ? parseInt(dias, 10) : 7;
        return this.pixService.listCobrancas(numDias);
    }

    @Post('reconciliar')
    @Roles(Role.ADMIN)
    @ApiOperation({ 
        summary: '🔄 Reconciliar cobranças PIX pendentes',
        description: 'Verifica cobranças pagas no Inter que não foram creditadas e processa automaticamente.'
    })
    async reconciliarCobrancas(@Query('dias') dias?: string) {
        const numDias = dias ? parseInt(dias, 10) : 7;
        return this.pixService.reconciliarCobrancas(numDias);
    }
}