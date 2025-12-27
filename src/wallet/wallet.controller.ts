import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletNetwork } from '@prisma/client';
import type { AuthRequest } from '../auth/jwt-payload.type';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  private getCustomerId(req: AuthRequest): string {
    const customerId = req.user?.customerId;
    if (!customerId) {
      throw new BadRequestException('customerId não encontrado no token');
    }
    return customerId;
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as wallets do customer' })
  @ApiQuery({ name: 'network', enum: WalletNetwork, required: false })
  async listWallets(@Req() req: AuthRequest, @Query('network') network?: WalletNetwork) {
    const customerId = this.getCustomerId(req);
    return this.walletService.getWalletsByCustomer(customerId, network);
  }

  @Get('solana-usdt-balance')
  @ApiOperation({ summary: 'Consultar saldo USDT em endereço Solana' })
  async getSolanaUsdtBalance(@Query('address') address: string, @Req() req: AuthRequest) {
    const customerId = this.getCustomerId(req);
    return this.walletService.getSolanaUsdtBalance(address, customerId);
  }

  @Get('tron-usdt-balance')
  @ApiOperation({ summary: 'Consultar saldo USDT em endereço Tron' })
  async getTronUsdtBalance(@Query('address') address: string, @Req() req: AuthRequest) {
    const customerId = this.getCustomerId(req);
    return this.walletService.getTronUsdtBalance(address, customerId);
  }

  @Post('sync-all')
  @ApiOperation({ summary: 'Sincronizar saldo de todas as carteiras com a blockchain' })
  async syncAllBalances(@Req() req: AuthRequest) {
    const customerId = this.getCustomerId(req);
    return this.walletService.syncAllWalletBalances(customerId);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sincronizar saldo de uma carteira específica' })
  async syncWalletBalance(@Req() req: AuthRequest, @Param('id') id: string) {
    const customerId = this.getCustomerId(req);
    return this.walletService.syncWalletBalance(id, customerId);
  }

  @Patch(':id/balance')
  @ApiOperation({ summary: 'Atualizar saldo da carteira manualmente (admin)' })
  async updateWalletBalance(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('balance') balance: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.updateWalletBalance(id, customerId, balance);
  }

  @Get('usdt')
  @ApiOperation({ summary: 'Listar todas as wallets USDT do customer' })
  async getAllUsdtWallets(@Req() req: AuthRequest) {
    const customerId = this.getCustomerId(req);
    return this.walletService.getAllUsdtWalletsForCustomer(customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter wallet por ID' })
  async getWallet(@Req() req: AuthRequest, @Param('id') id: string) {
    const customerId = this.getCustomerId(req);
    return this.walletService.getWalletById(id, customerId);
  }

  @Post('create-solana')
  @ApiOperation({ summary: 'Criar nova wallet Solana (gera keypair)' })
  async createSolanaWallet(@Req() req: AuthRequest, @Body('label') label?: string) {
    const customerId = this.getCustomerId(req);
    return this.walletService.createSolanaWallet(customerId, label);
  }

  @Post('create-tron')
  @ApiOperation({ summary: 'Criar nova wallet Tron (gera keypair)' })
  async createTronWallet(@Req() req: AuthRequest, @Body('label') label?: string) {
    const customerId = this.getCustomerId(req);
    return this.walletService.createTronWallet(customerId, label);
  }

  @Post('import')
  @ApiOperation({ summary: 'Importar wallet externa' })
  async importWallet(
    @Req() req: AuthRequest,
    @Body('network') network: WalletNetwork,
    @Body('address') address: string,
    @Body('label') label?: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.importWallet(customerId, network, address, label);
  }

  @Patch(':id/set-main')
  @ApiOperation({ summary: 'Definir wallet como principal para a rede' })
  async setMainWallet(@Req() req: AuthRequest, @Param('id') id: string) {
    const customerId = this.getCustomerId(req);
    return this.walletService.setMainWallet(id, customerId);
  }

  @Patch(':id/label')
  @ApiOperation({ summary: 'Atualizar label da wallet' })
  async updateLabel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('label') label: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.updateWalletLabel(id, customerId, label);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover wallet (não pode ser a principal)' })
  async deleteWallet(@Req() req: AuthRequest, @Param('id') id: string) {
    const customerId = this.getCustomerId(req);
    return this.walletService.deleteWallet(id, customerId);
  }

  @Get('quote-usdt')
  @ApiOperation({ summary: 'Cotação: quanto USDT o cliente recebe por X BRL' })
  @ApiQuery({ name: 'brlAmount', type: Number, required: true })
  @ApiQuery({ name: 'walletId', type: String, required: false })
  async getUsdtQuote(
    @Req() req: AuthRequest,
    @Query('brlAmount') brlAmount: string,
    @Query('walletId') walletId?: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.getUsdtQuote(customerId, Number(brlAmount), walletId);
  }

  @Post('buy-usdt-with-brl')
  @ApiOperation({ summary: 'Comprar USDT com BRL e transferir para wallet' })
  async buyUsdtWithBrl(
    @Req() req: AuthRequest,
    @Body('brlAmount') brlAmount: number,
    @Body('walletId') walletId?: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.buyUsdtWithBrl(customerId, brlAmount, walletId);
  }

  @Post('sell-usdt-for-brl')
  @ApiOperation({ summary: 'Vender USDT e creditar BRL na conta' })
  async sellUsdtForBrl(
    @Req() req: AuthRequest,
    @Body('usdtAmount') usdtAmount: number,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.sellUsdtForBrl(customerId, usdtAmount);
  }

  @Patch(':id/okx-whitelist')
  @ApiOperation({ summary: 'Marcar wallet como whitelistada na OKX' })
  async setOkxWhitelisted(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('whitelisted') whitelisted: boolean,
  ) {
    const customerId = this.getCustomerId(req);
    return this.walletService.setOkxWhitelisted(id, customerId, whitelisted);
  }
}
