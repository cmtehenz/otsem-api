import {
    Controller,
    Get,
    Query,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { Req } from '@nestjs/common';

interface User {
    role: 'CUSTOMER' | 'ADMIN';
    customerId?: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Get()
    @ApiOperation({ summary: 'Listar pagamentos' })
    async listPayments(
        @Query('customerId') customerIdQuery: string,
        @Query('dataInicio') dataInicio: string,
        @Query('dataFim') dataFim: string,
        @Req() req: Request
    ) {
        const user = req.user as User;

        if (user.role === 'ADMIN' && !customerIdQuery) {
            return this.paymentsService.listPayments({
                dataInicio,
                dataFim,
            });
        }

        let customerId = user.customerId;
        if (user.role === 'ADMIN' && customerIdQuery) {
            customerId = customerIdQuery;
        }

        if (!customerId) {
            throw new BadRequestException('customerId não encontrado');
        }

        return this.paymentsService.listPayments({
            customerId,
            dataInicio,
            dataFim,
        });
    }
}