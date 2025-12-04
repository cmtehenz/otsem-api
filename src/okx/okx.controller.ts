import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { OkxService } from './services/okx.service';

@Controller('okx')
export class OkxController {
    constructor(private readonly okxService: OkxService) { }

    @Get('balance-brl')
    async getBrlBalance() {
        return await this.okxService.getBrlBalance();
    }

    @Get('balance-usdt')
    async getUsdtBalance() {
        return await this.okxService.getUsdtBalance();
    }

    @Post('buy-and-check-history')
    async buyAndCheckHistory(@Body('brlAmount') brlAmount: number) {
        return await this.okxService.buyAndCheckHistory(brlAmount);
    }

    @Post('withdraw-usdt')
    async safeWithdrawUsdt(@Body() body: {
        amount: string | number;
        toAddress: string;
        fundPwd: string;
        fee: string | number;
    }) {
        // Rede fixa como SOL para Solana
        return await this.okxService.withdrawUsdt({
            currency: 'USDT',
            amount: body.amount,
            toAddress: body.toAddress,
            network: 'Solana',
            fundPwd: body.fundPwd,
            fee: body.fee
        });
    }

}