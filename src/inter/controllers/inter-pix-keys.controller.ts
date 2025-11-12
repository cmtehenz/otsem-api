// src/inter/controllers/inter-pix-keys.controller.ts

import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterPixKeysService } from '../services/inter-pix-keys.service';
import { RegisterPixKeyDto } from '../dto/register-pix-key.dto';

@ApiTags('Inter - Pix Keys')
@ApiBearerAuth()
@Controller('inter/pix/keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterPixKeysController {
    constructor(private readonly service: InterPixKeysService) { }
    @Post('random')
    @ApiOperation({ summary: 'Cadastrar chave Pix aleatória para o customer logado' })
    @ApiResponse({ status: 201, description: 'Chave Pix criada com sucesso' })
    async registerRandomKey(@Request() req: ExpressRequest & { user: any }) {
        const customerId = req.user.customerId;
        const pixKey = await this.service.registerRandomKey(customerId);

        return {
            pixKey,
            message: 'Chave Pix aleatória cadastrada com sucesso',
        };
    }
    @Post()
    @ApiOperation({ summary: 'Cadastrar chave Pix específica (CPF, Email, Telefone)' })
    @ApiResponse({ status: 201, description: 'Chave Pix cadastrada com sucesso' })
    async registerKey(@Request() req: ExpressRequest & { user: any }, @Body() dto: RegisterPixKeyDto) {
        const customerId = req.user.customerId;

        if (dto.tipoChave === 'ALEATORIA') {
            const pixKey = await this.service.registerRandomKey(customerId);
            return { pixKey, message: 'Chave Pix aleatória cadastrada' };
        }

        if (!dto.chave) {
            throw new Error('Campo "chave" é obrigatório para este tipo');
        }

        return this.service.registerKey(customerId, dto.tipoChave, dto.chave);
    }

    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Listar todas as chaves Pix cadastradas (Admin)' })
    async listKeys() {
        return this.service.listKeys();
    }

    @Get(':chave')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Consultar chave Pix específica (Admin)' })
    @ApiParam({ name: 'chave', example: '12345678901' })
    async getKey(@Param('chave') chave: string) {
        return this.service.getKey(chave);
    }

    @Delete(':chave')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Excluir chave Pix (Admin)' })
    @ApiParam({ name: 'chave', example: '12345678901' })
    async deleteKey(@Param('chave') chave: string) {
        return this.service.deleteKey(chave);
    }

    @Get(':chave/available')
    @ApiOperation({ summary: 'Verificar se chave Pix está disponível' })
    @ApiParam({ name: 'chave', example: '12345678901' })
    async checkAvailability(@Param('chave') chave: string) {
        const available = await this.service.isKeyAvailable(chave);
        return {
            chave,
            available,
            message: available ? 'Chave disponível' : 'Chave já cadastrada',
        };
    }
}