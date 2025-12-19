import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OkxService } from './services/okx.service';

@ApiTags('OKX')
@Controller('okx')
export class OkxController {
    constructor(private readonly okxService: OkxService) { }

    @Get('balance-brl')
    @ApiOperation({ summary: 'Saldo BRL na OKX' })
    async getBrlBalance() {
        return await this.okxService.getBrlBalance();
    }

    @Get('balance-usdt')
    @ApiOperation({ summary: 'Saldo USDT na OKX' })
    async getUsdtBalance() {
        return await this.okxService.getUsdtBalance();
    }

    @Post('buy-and-check-history')
    @ApiOperation({ summary: 'Comprar USDT com BRL e retornar detalhes' })
    async buyAndCheckHistory(@Body('brlAmount') brlAmount: number) {
        return await this.okxService.buyAndCheckHistory(brlAmount);
    }

    @Post('withdraw-usdt')
    @ApiOperation({ summary: 'Sacar USDT para endereço externo' })
    async safeWithdrawUsdt(@Body() body: {
        amount: string | number;
        toAddress: string;
        fundPwd: string;
        fee: string | number;
    }) {
        return await this.okxService.withdrawUsdt({
            currency: 'USDT',
            amount: body.amount,
            toAddress: body.toAddress,
            network: 'Solana',
            fundPwd: body.fundPwd,
            fee: body.fee
        });
    }

    @Get('deposit-address')
    @ApiOperation({ summary: 'Endereço de depósito USDT (Solana ou Tron)' })
    @ApiQuery({ name: 'network', enum: ['Solana', 'TRC20'], required: true })
    async getDepositAddress(@Query('network') network: 'Solana' | 'TRC20') {
        return await this.okxService.getDepositAddress(network);
    }

    @Get('deposits')
    @ApiOperation({ summary: 'Lista depósitos recentes de USDT' })
    async getRecentDeposits() {
        return await this.okxService.getRecentDeposits();
    }
}