// src/inter/controllers/inter-pix.controller.ts

import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterPixService } from '../services/inter-pix.service';
import { CreatePixChargeDto } from '../dto/create-pix-charge.dto';
import { SendPixDto } from '../dto/send-pix.dto';

@ApiTags('Inter - Pix')
@ApiBearerAuth()
@Controller('inter/pix')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterPixController {
    constructor(private readonly service: InterPixService) { }

    @Get('chaves')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Listar chaves Pix (Admin)' })
    async getChaves() {
        return this.service.getChaves();
    }

    @Post('cobrancas')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Criar cobrança Pix (QR Code)' })
    async createCobranca(@Body() dto: CreatePixChargeDto) {
        return this.service.createCobranca(dto);
    }

    @Get('cobrancas/:txid')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Consultar cobrança Pix' })
    async getCobranca(@Param('txid') txid: string) {
        return this.service.getCobranca(txid);
    }

    @Post('send')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Enviar Pix (pagamento)' })
    async sendPix(@Body() dto: SendPixDto) {
        return this.service.sendPix(dto);
    }
}