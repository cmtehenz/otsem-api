// src/transactions/transactions.controller.ts

import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { Request as ExpressRequest } from 'express';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
    constructor(private readonly service: TransactionsService) { }

    @ApiOperation({ summary: 'Listar transações do customer logado' })
    @ApiQuery({ name: 'limit', required: false, example: 50 })
    async findAll(@Request() req: ExpressRequest & { user: { customerId: string } }, @Query('limit') limit?: string) {
        const customerId = req.user.customerId;

        // Buscar account do customer
        const account = await this.service['prisma'].account.findUnique({
            where: { customerId },
        });

        if (!account) {
            return [];
        }

        const limitNumber = limit ? parseInt(limit, 10) : 50;
        return this.service.findByAccount(account.id, limitNumber);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Buscar transação por ID' })
    @ApiParam({ name: 'id', example: 'tx-uuid' })
    async findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Post(':id/reverse')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Reverter transação (Admin apenas)' })
    @ApiParam({ name: 'id', example: 'tx-uuid' })
    async reverse(@Param('id') id: string, @Body() body: { reason?: string }) {
        return this.service.reverseTransaction(id, body.reason);
    }
}