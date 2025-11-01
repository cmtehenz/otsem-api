// src/pix/transactions/pix-transactions.controller.ts
import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { PixTransactionsService } from './pix-transactions.service';

@Controller('pix/transactions')
export class PixTransactionsController {
    constructor(private readonly svc: PixTransactionsService) { }

    @Get('account-holders/:accountHolderId/precheck')
    async precheck(
        @Param('accountHolderId') accountHolderId: string,
        @Query('pixKey') pixKey: string,
        @Query('value') value: string,
    ) {
        return this.svc.precheckKey(accountHolderId, pixKey, value);
    }

    @Post('account-holders/:accountHolderId/send')
    async send(
        @Param('accountHolderId') id: string,
        @Body() body: { pixKey: string; amount: string; description?: string; runPrecheck?: boolean }
    ) {
        return this.svc.sendPix(id, body);
    }

    @Post('account-holders/:accountHolderId/receive')
    async receive(
        @Param('accountHolderId') id: string,
        @Body() body: { amount: string; description?: string }
    ) {
        return this.svc.createCharge(id, body);
    }

    @Get('account-holders/:accountHolderId')
    async history(
        @Param('accountHolderId') id: string,
        @Query('page') page = '1',
        @Query('pageSize') pageSize = '10',
        @Query('status') status?: string
    ) {
        return this.svc.getHistory({
            accountHolderId: id,
            page: Number(page),
            pageSize: Number(pageSize),
            status,
        });
    }
}
