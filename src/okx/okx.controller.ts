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

    @Post('withdraw-crypto')
    @ApiOperation({ summary: 'Sacar qualquer crypto (SOL, TRX, etc) para endereço externo' })
    async withdrawCrypto(@Body() body: {
        currency: string;
        amount: string;
        toAddress: string;
        chain: string;
        fee?: string;
    }) {
        const fee = body.fee || await this.okxService.getWithdrawalFee(body.currency, body.chain);
        return await this.okxService.withdrawCrypto({
            currency: body.currency,
            amount: body.amount,
            toAddress: body.toAddress,
            chain: body.chain,
            fee: fee
        });
    }

    @Get('withdrawal-fee')
    @ApiOperation({ summary: 'Taxa mínima de saque para uma crypto/chain' })
    @ApiQuery({ name: 'currency', type: String, required: true })
    @ApiQuery({ name: 'chain', type: String, required: true })
    async getWithdrawalFee(
        @Query('currency') currency: string,
        @Query('chain') chain: string
    ) {
        const fee = await this.okxService.getWithdrawalFee(currency, chain);
        return { currency, chain, minFee: fee };
    }

    @Post('buy-crypto')
    @ApiOperation({ summary: 'Comprar crypto (SOL, TRX, etc) com USDT' })
    async buyCrypto(@Body() body: { crypto: string; usdtAmount: number }) {
        return await this.okxService.buyCryptoWithUsdt(body.crypto, body.usdtAmount);
    }

    @Get('crypto-balance')
    @ApiOperation({ summary: 'Saldo de qualquer crypto na conta trading' })
    @ApiQuery({ name: 'currency', type: String, required: true })
    async getCryptoBalance(@Query('currency') currency: string) {
        const balance = await this.okxService.getCryptoBalance(currency);
        return { currency, balance };
    }

    @Post('transfer-crypto-to-funding')
    @ApiOperation({ summary: 'Transferir crypto de trading para funding (para saque)' })
    async transferCryptoToFunding(@Body() body: { currency: string; amount: string }) {
        return await this.okxService.transferCryptoToFunding(body.currency, body.amount);
    }
}