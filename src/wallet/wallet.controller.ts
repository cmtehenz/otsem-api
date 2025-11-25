import { Controller, Get, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Get('create-solana')
    createSolanaWallet() {
        return this.walletService.createSolanaWallet();
    }

    @Get('solana-usdt-balance')
    async getSolanaUsdtBalance(@Query('address') address: string) {
        return await this.walletService.getSolanaUsdtBalance(address);
    }
}