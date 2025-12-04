import { Controller, Get, Query, Post, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ajuste o caminho conforme seu projeto

@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @UseGuards(JwtAuthGuard) // proteja a rota
    @Post('create-solana')
    async createSolanaWalletForCustomer(@Req() req: Request) {
        const customerId = (req.user as any).customerId;
        return await this.walletService.createSolanaWalletForCustomer(customerId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('solana-usdt-balance')
    async getSolanaUsdtBalance(@Query('address') address: string, @Req() req: Request) {
        const customerId = (req.user as any).customerId;
        return await this.walletService.getSolanaUsdtBalance(address, customerId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('usdt')
    async getAllUsdtWalletsForCustomer(@Req() req: Request) {
        const customerId = (req.user as any).customerId;
        return await this.walletService.getAllUsdtWalletsForCustomer(customerId);
    }

    @Get('teste-balance')
    async getBalance() {
        return 0;
    }
}