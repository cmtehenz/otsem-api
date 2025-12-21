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
    @ApiOperation({ summary: 'Sacar USDT para endereço externo (completo)' })
    async safeWithdrawUsdt(@Body() body: {
        amount: string | number;
        toAddress: string;
        fundPwd: string;
        fee: string | number;
        network?: string;
    }) {
        return await this.okxService.withdrawUsdt({
            currency: 'USDT',
            amount: body.amount,
            toAddress: body.toAddress,
            network: body.network || 'Solana',
            fundPwd: body.fundPwd,
            fee: body.fee
        });
    }

    @Post('withdraw-simple')
    @ApiOperation({ summary: 'Sacar USDT (simplificado - taxa automática)' })
    async withdrawSimple(@Body() body: {
        amount: string | number;
        address: string;
        network?: 'Solana' | 'TRC20';
    }) {
        const network = body.network || 'TRC20';
        const fee = network === 'TRC20' ? '2.1' : '1';
        return await this.okxService.withdrawUsdtSimple(
            String(body.amount),
            body.address,
            network,
            fee
        );
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

    @Get('withdrawals')
    @ApiOperation({ summary: 'Lista saques recentes de USDT' })
    async getRecentWithdrawals() {
        return await this.okxService.getRecentWithdrawals();
    }

    @Get('trades')
    @ApiOperation({ summary: 'Histórico de trades (compras/vendas)' })
    async getTradeHistory() {
        return await this.okxService.getTradeHistory();
    }

    @Post('transfer-to-funding')
    @ApiOperation({ summary: 'Transferir USDT de trading para funding' })
    async transferToFunding(@Body('amount') amount: string) {
        return await this.okxService.transferFromTradingToFunding('USDT', amount);
    }

    @Get('funding-balance')
    @ApiOperation({ summary: 'Saldo USDT na conta funding (para saque)' })
    async getFundingBalance() {
        return await this.okxService.getFundingBalance('USDT');
    }
}