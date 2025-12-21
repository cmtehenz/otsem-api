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

    @Get()
    @ApiOperation({ summary: 'Listar transações do customer logado com paginação' })
    @ApiQuery({ name: 'page', required: false, example: 1, description: 'Página (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Itens por página (default: 20, max: 100)' })
    async findAll(
        @Request() req: ExpressRequest & { user: { customerId: string } },
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const customerId = req.user.customerId;

        const account = await this.service['prisma'].account.findUnique({
            where: { customerId },
        });

        if (!account) {
            return {
                data: [],
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
            };
        }

        const pageNumber = Math.max(1, parseInt(page || '1', 10));
        const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));

        return this.service.findByAccount(account.id, pageNumber, limitNumber);
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