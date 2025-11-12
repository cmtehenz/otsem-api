// src/inter/controllers/inter-banking.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterBankingService } from '../services/inter-banking.service';

@ApiTags('Inter - Banking')
@ApiBearerAuth()
@Controller('inter/banking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterBankingController {
    constructor(private readonly service: InterBankingService) { }

    @Get('saldo')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Consultar saldo da conta Inter (Admin)' })
    async getSaldo() {
        return this.service.getSaldo();
    }

    @Get('extrato')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Consultar extrato (Admin)' })
    @ApiQuery({ name: 'dataInicio', required: false, example: '2025-11-01' })
    @ApiQuery({ name: 'dataFim', required: false, example: '2025-11-12' })
    @ApiQuery({ name: 'dias', required: false, example: 30 })
    async getExtrato(
        @Query('dataInicio') dataInicio?: string,
        @Query('dataFim') dataFim?: string,
        @Query('dias') dias?: string,
    ) {
        if (dataInicio && dataFim) {
            return this.service.getExtrato(dataInicio, dataFim);
        }

        const diasNumber = dias ? parseInt(dias, 10) : 30;
        return this.service.getExtratoUltimosDias(diasNumber);
    }
}