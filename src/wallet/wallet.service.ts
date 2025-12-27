import { Injectable, BadRequestException, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { PixKeyType } from '../inter/dto/send-pix.dto';
import { OkxService } from '../okx/services/okx.service';
import { TronService } from '../tron/tron.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { WalletNetwork, TransactionType } from '@prisma/client';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interPixService: InterPixService,
    private readonly okxService: OkxService,
    private readonly tronService: TronService,
    @Inject(forwardRef(() => AffiliatesService))
    private readonly affiliatesService: AffiliatesService,
  ) { }

  getTronService() {
    return this.tronService;
  }

  async createWallet(
    customerId: string,
    network: WalletNetwork,
    externalAddress: string,
    options?: { currency?: string; label?: string; isMain?: boolean },
  ) {
    const existing = await this.prisma.wallet.findUnique({
      where: { customerId_network_externalAddress: { customerId, network, externalAddress } },
    });
    if (existing) {
      throw new BadRequestException('Wallet com este endereço já existe nesta rede');
    }

    if (options?.isMain) {
      await this.prisma.wallet.updateMany({
        where: { customerId, network, isMain: true },
        data: { isMain: false },
      });
    }

    return this.prisma.wallet.create({
      data: {
        customerId,
        network,
        externalAddress,
        currency: options?.currency || 'USDT',
        label: options?.label,
        isMain: options?.isMain ?? false,
        balance: 0,
      },
    });
  }

  async createSolanaWallet(customerId: string, label?: string) {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = Buffer.from(keypair.secretKey).toString('hex');

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'SOLANA', isMain: true },
    });

    const wallet = await this.createWallet(customerId, 'SOLANA', publicKey, {
      currency: 'USDT',
      label: label || 'Solana Wallet',
      isMain: !existingMain,
    });

    return { publicKey, secretKey, wallet };
  }

  async createSolanaWalletForCustomer(customerId: string) {
    return this.createSolanaWallet(customerId);
  }

  async createTronWallet(customerId: string, label?: string) {
    const { address, privateKey } = await this.tronService.createWallet();

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'TRON', isMain: true },
    });

    const wallet = await this.createWallet(customerId, 'TRON', address, {
      currency: 'USDT',
      label: label || 'Tron Wallet',
      isMain: !existingMain,
    });

    return { address, privateKey, wallet };
  }

  async importWallet(
    customerId: string,
    network: WalletNetwork,
    externalAddress: string,
    label?: string,
  ) {
    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network, isMain: true },
    });

    return this.createWallet(customerId, network, externalAddress, {
      currency: 'USDT',
      label: label || `${network} Wallet`,
      isMain: !existingMain,
    });
  }

  async getWalletsByCustomer(customerId: string, network?: WalletNetwork) {
    const where: any = { customerId };
    if (network) where.network = network;
    return this.prisma.wallet.findMany({
      where,
      orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getWalletById(walletId: string, customerId?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet não encontrada');
    if (customerId && wallet.customerId !== customerId) {
      throw new BadRequestException('Wallet não pertence a este customer');
    }
    return wallet;
  }

  async setMainWallet(walletId: string, customerId: string) {
    const wallet = await this.getWalletById(walletId, customerId);

    await this.prisma.wallet.updateMany({
      where: { customerId, network: wallet.network, isMain: true },
      data: { isMain: false },
    });

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { isMain: true },
    });
  }

  async updateWalletLabel(walletId: string, customerId: string, label: string) {
    await this.getWalletById(walletId, customerId);
    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { label },
    });
  }

  async deleteWallet(walletId: string, customerId: string) {
    const wallet = await this.getWalletById(walletId, customerId);
    if (wallet.isMain) {
      throw new BadRequestException('Não é possível deletar a wallet principal');
    }
    return this.prisma.wallet.delete({ where: { id: walletId } });
  }

  async getMainWallet(customerId: string, network: WalletNetwork) {
    return this.prisma.wallet.findFirst({
      where: { customerId, network, isMain: true },
    });
  }

  async getSolanaUsdtBalance(address: string, customerId?: string): Promise<string> {
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      let owner: PublicKey;
      try {
        owner = new PublicKey(address);
      } catch {
        throw new Error('Endereço Solana inválido');
      }

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      let saldo = 0;
      for (const acc of tokenAccounts.value) {
        const info = acc.account.data.parsed.info;
        if (info.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
          saldo += Number(info.tokenAmount.amount);
        }
      }
      const saldoUsdt = (saldo / 1e6).toString();

      if (customerId) {
        await this.prisma.wallet.updateMany({
          where: { customerId, externalAddress: address },
          data: { balance: saldoUsdt },
        });
      }

      return saldoUsdt;
    } catch (err: any) {
      if (err.message === 'Endereço Solana inválido') throw err;
      console.error('Erro ao consultar saldo USDT:', err);
      return '0';
    }
  }

  async getTronUsdtBalance(address: string, customerId?: string): Promise<string> {
    try {
      const balance = await this.tronService.getUsdtBalance(address);
      const saldoUsdt = balance.toString();

      if (customerId) {
        await this.prisma.wallet.updateMany({
          where: { customerId, externalAddress: address, network: 'TRON' },
          data: { balance: saldoUsdt },
        });
      }

      return saldoUsdt;
    } catch (err: any) {
      this.logger.error(`Erro ao consultar saldo USDT Tron: ${err.message}`);
      return '0';
    }
  }

  async syncWalletBalance(walletId: string, customerId: string): Promise<{ balance: string; wallet: any }> {
    const wallet = await this.getWalletById(walletId, customerId);
    
    let balance = '0';
    if (wallet.externalAddress) {
      if (wallet.network === 'SOLANA') {
        balance = await this.getSolanaUsdtBalance(wallet.externalAddress, customerId);
      } else if (wallet.network === 'TRON') {
        balance = await this.getTronUsdtBalance(wallet.externalAddress, customerId);
      }
    }

    const updatedWallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    return { balance, wallet: updatedWallet };
  }

  async updateWalletBalance(walletId: string, customerId: string, balance: string): Promise<any> {
    const wallet = await this.getWalletById(walletId, customerId);
    return this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance },
    });
  }

  async syncAllWalletBalances(customerId: string): Promise<any[]> {
    const wallets = await this.prisma.wallet.findMany({ where: { customerId } });
    const results: any[] = [];

    for (const wallet of wallets) {
      try {
        let balance = '0';
        if (wallet.externalAddress) {
          if (wallet.network === 'SOLANA') {
            balance = await this.getSolanaUsdtBalance(wallet.externalAddress, customerId);
          } else if (wallet.network === 'TRON') {
            balance = await this.getTronUsdtBalance(wallet.externalAddress, customerId);
          }
        }
        results.push({ id: wallet.id, network: wallet.network, address: wallet.externalAddress, balance });
      } catch (err: any) {
        results.push({ id: wallet.id, network: wallet.network, address: wallet.externalAddress, balance: wallet.balance, error: err.message });
      }
    }

    return results;
  }

  async getAllUsdtWalletsForCustomer(customerId: string) {
    return this.prisma.wallet.findMany({
      where: { customerId, currency: 'USDT' },
      orderBy: [{ network: 'asc' }, { isMain: 'desc' }],
    });
  }

  async getUsdtQuote(customerId: string, brlAmount: number, walletId?: string) {
    const account = await this.prisma.account.findFirst({ where: { customerId } });
    const balance = account ? Number(account.balance) : 0;

    let wallet: any = null;
    if (walletId) {
      wallet = await this.prisma.wallet.findFirst({
        where: { id: walletId, customerId, currency: 'USDT' },
      });
    } else {
      wallet = await this.prisma.wallet.findFirst({
        where: { customerId, currency: 'USDT', isMain: true, okxWhitelisted: true },
      });
      if (!wallet) {
        wallet = await this.prisma.wallet.findFirst({
          where: { customerId, currency: 'USDT', okxWhitelisted: true },
        });
      }
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } } },
    });

    const userSpreadMultiplier = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const baseSpreadRate = Number.isFinite(userSpreadMultiplier) && userSpreadMultiplier > 0 ? userSpreadMultiplier : 1;
    const baseSpreadPercent = 1 - baseSpreadRate;

    const affiliateSpread = await this.affiliatesService.getAffiliateSpreadForCustomer(customerId);
    const affiliateSpreadPercent = affiliateSpread.spreadAffiliate;
    const totalSpreadPercent = baseSpreadPercent + affiliateSpreadPercent;
    const spreadRate = 1 - totalSpreadPercent;

    const brlExchanged = Number((brlAmount * spreadRate).toFixed(2));
    const spreadBrl = Number((brlAmount - brlExchanged).toFixed(2));

    const okxRate = await this.okxService.getBrlToUsdtRate();
    const exchangeRate = okxRate || 5.5;
    const usdtEstimate = Number((brlExchanged / exchangeRate).toFixed(2));

    const network = wallet?.network || 'SOLANA';
    const networkFee = network === 'TRON' ? 2.1 : 1.0;
    const usdtNet = Math.max(0, usdtEstimate - networkFee);

    const minBrl = networkFee * exchangeRate * (1 / spreadRate) + 1;

    return {
      brlAmount,
      brlExchanged,
      spreadPercent: Math.round(totalSpreadPercent * 10000) / 100,
      spreadBrl,
      exchangeRate,
      usdtEstimate,
      network,
      networkFeeUsdt: networkFee,
      networkFeeBrl: Number((networkFee * exchangeRate).toFixed(2)),
      usdtNet,
      wallet: wallet ? {
        id: wallet.id,
        address: wallet.externalAddress,
        network: wallet.network,
        whitelisted: wallet.okxWhitelisted,
      } : null,
      balanceBrl: balance,
      canProceed: balance >= brlAmount && brlAmount >= 10 && usdtNet > 0 && wallet?.okxWhitelisted,
      minBrlRecommended: Math.ceil(minBrl),
      message: usdtNet <= 0 
        ? `Valor mínimo para esta rede: R$ ${Math.ceil(minBrl)}` 
        : `Você receberá ${usdtNet.toFixed(2)} USDT`,
    };
  }

  async buyUsdtWithBrl(customerId: string, brlAmount: number, walletId?: string) {
    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account || Number(account.balance) < brlAmount || brlAmount < 10) {
      throw new Error('Saldo insuficiente em BRL (mínimo R$10)');
    }

    // Obter spread base do User.spreadValue (legacy) + spread do afiliado
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } }, affiliateId: true },
    });
    
    // User.spreadValue é um multiplicador (ex: 0.95 = 5% spread, 1.0 = sem spread)
    const userSpreadMultiplier = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const baseSpreadRate = Number.isFinite(userSpreadMultiplier) && userSpreadMultiplier > 0 ? userSpreadMultiplier : 1;
    const baseSpreadPercent = 1 - baseSpreadRate; // ex: 1 - 0.95 = 0.05 (5%)
    
    // Obter spread adicional do afiliado
    const affiliateSpread = await this.affiliatesService.getAffiliateSpreadForCustomer(customerId);
    const affiliateSpreadPercent = affiliateSpread.spreadAffiliate; // ex: 0.0035 (0.35%)
    
    // Spread total = base + afiliado
    const totalSpreadPercent = baseSpreadPercent + affiliateSpreadPercent;
    const spreadRate = 1 - totalSpreadPercent;
    
    const brlToExchange = Number((brlAmount * spreadRate).toFixed(2));
    const spreadAmount = Number((brlAmount - brlToExchange).toFixed(2));
    
    this.logger.log(`[Conversion] Spread: userBase=${baseSpreadPercent.toFixed(4)}, affiliate=${affiliateSpreadPercent.toFixed(4)}, total=${totalSpreadPercent.toFixed(4)}, rate=${spreadRate.toFixed(4)}`);

    const stages: { pixTransfer: string; conversion: string; usdtTransfer: string } = {
      pixTransfer: 'pending', // 1 - transferindo reais via PIX para OKX
      conversion: 'pending', // 2 - comprando USDT na OKX
      usdtTransfer: 'pending', // 3 - enviando USDT para carteira do cliente
    };

    let pixResult: any = null;
    let okxBuyResult: any = null;
    let withdrawResult: any = null;

    try {
      // 1) PIX para conta OKX
      pixResult = await this.interPixService.sendPix(customerId, {
        valor: brlAmount,
        chaveDestino: '50459025000126',
        tipoChave: PixKeyType.CHAVE,
        descricao: customerId,
      });
      stages.pixTransfer = 'done';

      // 2) Compra USDT na OKX e verifica quantidade comprada
      await new Promise((resolve) => setTimeout(resolve, 5000));
      okxBuyResult = await this.okxService.buyAndCheckHistory(brlToExchange);
      stages.conversion = 'done';

      // Calcular quantidade de USDT comprada a partir dos fills
      let usdtAmount = 0;
      if (okxBuyResult.detalhes && okxBuyResult.detalhes.length > 0) {
        usdtAmount = okxBuyResult.detalhes.reduce((sum: number, fill: any) => {
          return sum + parseFloat(fill.fillSz || '0');
        }, 0);
      }
      if (usdtAmount <= 0) {
        throw new Error('Não foi possível determinar a quantidade de USDT comprada');
      }

      // 3) Determinar carteira de destino (precisa antes de criar transação)
      let wallet;
      if (walletId) {
        wallet = await this.getWalletById(walletId, customerId);
      } else {
        wallet = await this.getMainWallet(customerId, 'SOLANA');
        if (!wallet) {
          wallet = await this.getMainWallet(customerId, 'TRON');
        }
      }

      if (!wallet || !wallet.externalAddress) {
        throw new Error('Carteira (Solana ou Tron) não encontrada para o cliente');
      }

      if (!wallet.okxWhitelisted) {
        throw new Error('Carteira não está na whitelist da OKX. Adicione o endereço na OKX e marque como whitelistada antes de converter.');
      }

      // 4) Registrar transação CONVERSION com dados da carteira
      const balanceBefore = account.balance;
      const conversionId = `CONV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.CONVERSION,
          status: 'COMPLETED',
          amount: brlAmount,
          balanceBefore,
          balanceAfter: balanceBefore,
          description: `Conversão BRL→USDT: R$ ${brlAmount.toFixed(2)} → ${usdtAmount.toFixed(2)} USDT`,
          externalId: conversionId,
          endToEnd: pixResult?.endToEndId,
          externalData: {
            pixEndToEnd: pixResult?.endToEndId,
            okxBuyResult,
            usdtAmount,
            walletAddress: wallet.externalAddress,
            network: wallet.network,
            spread: { chargedBrl: brlAmount, exchangedBrl: brlToExchange, spreadBrl: spreadAmount, spreadRate },
          },
          completedAt: new Date(),
        },
      });

      // Persist spread + etapas em Payment/Transaction (se houver endToEnd)
      if (pixResult?.endToEndId) {
        const payment = await this.prisma.payment.findUnique({ where: { endToEnd: pixResult.endToEndId } });
        if (payment) {
          const bankPayload = (payment.bankPayload as any) || {};
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              bankPayload: {
                ...bankPayload,
                spread: {
                  chargedBrl: brlAmount,
                  exchangedBrl: brlToExchange,
                  spreadBrl: spreadAmount,
                  spreadRate,
                },
                okxBuyResult,
                stages,
              },
            },
          });
        }

        const tx = await this.prisma.transaction.findFirst({ where: { externalId: pixResult.endToEndId } });
        if (tx) {
          const metadata = (tx.metadata as any) || {};
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
              metadata: {
                ...metadata,
                spread: {
                  chargedBrl: brlAmount,
                  exchangedBrl: brlToExchange,
                  spreadBrl: spreadAmount,
                  spreadRate,
                },
                okxBuyResult,
                stages,
              },
            },
          });
        }
      }

      // 5) Transferência USDT para carteira do cliente (wallet já foi determinado acima)
      // Determinar rede e taxa
      const isTron = wallet.network === 'TRON';
      const networkFee = isTron ? 2.1 : 1; // TRC20: 2.1 USDT, Solana: 1 USDT
      const usdtToWithdraw = usdtAmount - networkFee;
      if (usdtToWithdraw <= 0) {
        throw new Error(`Quantidade de USDT insuficiente para saque. Comprado: ${usdtAmount}, taxa: ${networkFee}`);
      }

      // 5a) Transferir da conta trading para funding (necessário para saque)
      const totalToTransfer = usdtAmount.toFixed(2);
      this.logger.log(`[OKX] Transferindo ${totalToTransfer} USDT de trading para funding`);
      await this.okxService.transferFromTradingToFunding('USDT', totalToTransfer);

      // 5b) OKX → Cliente direto (Solana ou Tron)
      const network = isTron ? 'TRC20' : 'Solana';
      this.logger.log(`[${network}] Sacando ${usdtToWithdraw} USDT para: ${wallet.externalAddress}`);

      withdrawResult = await this.okxService.withdrawUsdtSimple(
        usdtToWithdraw.toFixed(2),
        wallet.externalAddress,
        network,
        networkFee.toString(),
      );
      stages.usdtTransfer = 'done';

      // Persist estágio final
      if (pixResult?.endToEndId) {
        const payment = await this.prisma.payment.findUnique({ where: { endToEnd: pixResult.endToEndId } });
        if (payment) {
          const bankPayload = (payment.bankPayload as any) || {};
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { bankPayload: { ...bankPayload, stages } },
          });
        }

        const tx = await this.prisma.transaction.findFirst({ where: { externalId: pixResult.endToEndId } });
        if (tx) {
          const metadata = (tx.metadata as any) || {};
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: { metadata: { ...metadata, stages } },
          });
        }
      }

      // 6) Registrar comissão do afiliado (se aplicável)
      let affiliateCommission = null;
      if (affiliateSpread.affiliate && affiliateSpreadPercent > 0) {
        affiliateCommission = await this.affiliatesService.recordCommission({
          affiliateId: affiliateSpread.affiliate.id,
          customerId,
          transactionId: pixResult?.endToEndId,
          transactionAmount: brlAmount,
          spreadTotal: totalSpreadPercent,
          spreadBase: baseSpreadPercent,
          spreadAffiliate: affiliateSpreadPercent,
        });
        this.logger.log(`[Affiliate] Commission recorded: R$ ${(brlAmount * affiliateSpreadPercent).toFixed(2)} for ${affiliateSpread.affiliate.code}`);
      }

      // 7) Criar registro na tabela Conversion (dados estruturados)
      const exchangeRate = usdtAmount > 0 ? brlToExchange / usdtAmount : 0;
      const okxWithdrawFeeUsdt = networkFee;
      const okxTradingFee = brlToExchange * 0.001;
      const okxWithdrawFeeBrl = okxWithdrawFeeUsdt * exchangeRate;
      const totalOkxFees = okxWithdrawFeeBrl + okxTradingFee;
      const affiliateCommissionBrl = affiliateCommission ? Number(affiliateCommission.commissionBrl) : 0;
      const grossProfit = spreadAmount;
      const netProfit = grossProfit - totalOkxFees - affiliateCommissionBrl;

      const conversionTx = await this.prisma.transaction.findFirst({
        where: { externalId: conversionId },
      });

      await this.prisma.conversion.create({
        data: {
          customerId,
          accountId: account.id,
          transactionId: conversionTx?.id,
          brlCharged: brlAmount,
          brlExchanged: brlToExchange,
          spreadPercent: totalSpreadPercent,
          spreadBrl: spreadAmount,
          usdtPurchased: usdtAmount,
          usdtWithdrawn: usdtToWithdraw,
          exchangeRate,
          network: wallet.network,
          walletAddress: wallet.externalAddress,
          walletId: wallet.id,
          pixEndToEnd: pixResult?.endToEndId,
          pixTxid: pixResult?.txid,
          okxOrderId: okxBuyResult?.orderId || null,
          okxWithdrawId: withdrawResult?.wdId || null,
          affiliateId: affiliateSpread.affiliate?.id || null,
          affiliateCommission: affiliateCommissionBrl,
          okxWithdrawFee: okxWithdrawFeeUsdt,
          okxTradingFee,
          totalOkxFees,
          grossProfit,
          netProfit,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      this.logger.log(`[Conversion] Registro criado: R$ ${brlAmount} → ${usdtAmount} USDT`);

      return {
        message: 'Compra e transferência de USDT concluída',
        pixResult,
        okxBuyResult,
        withdrawResult,
        usdtBought: usdtAmount,
        usdtWithdrawn: usdtToWithdraw,
        networkFee,
        spread: {
          chargedBrl: brlAmount,
          exchangedBrl: brlToExchange,
          spreadBrl: spreadAmount,
          spreadRate,
          base: baseSpreadPercent,
          affiliate: affiliateSpreadPercent,
          total: totalSpreadPercent,
        },
        affiliateCommission: affiliateCommission ? {
          affiliateCode: affiliateSpread.affiliate?.code,
          commissionBrl: Number(affiliateCommission.commissionBrl),
        } : null,
        stages,
        wallet: { id: wallet.id, network: wallet.network, address: wallet.externalAddress },
      };
    } catch (error) {
      // Persist estágio em erro, se possível
      if (pixResult?.endToEndId) {
        const payment = await this.prisma.payment.findUnique({ where: { endToEnd: pixResult.endToEndId } });
        const tx = await this.prisma.transaction.findFirst({ where: { externalId: pixResult.endToEndId } });
        const errorMsg = error instanceof Error ? error.message : 'Erro na compra/transferência USDT';

        if (payment) {
          const bankPayload = (payment.bankPayload as any) || {};
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { bankPayload: { ...bankPayload, stages, error: errorMsg } },
          });
        }

        if (tx) {
          const metadata = (tx.metadata as any) || {};
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: { metadata: { ...metadata, stages, error: errorMsg } },
          });
        }
      }

      throw error;
    }
  }

  /**
   * Vende USDT e credita BRL na conta do cliente
   * 
   * Fluxo:
   * 1. Verifica saldo USDT disponível na OKX
   * 2. Vende USDT na OKX, recebe BRL
   * 3. Aplica spread reverso (cliente recebe menos)
   * 4. Credita BRL na conta do cliente
   */
  async sellUsdtForBrl(customerId: string, usdtAmount: number) {
    if (usdtAmount < 1) {
      throw new Error('Quantidade mínima é 1 USDT');
    }

    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account) {
      throw new Error('Conta não encontrada para o cliente');
    }

    // Spread configurável por usuário (default: 1.0 = sem spread)
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } } },
    });
    const spreadRateRaw = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const spreadRate = Number.isFinite(spreadRateRaw) && spreadRateRaw > 0 ? spreadRateRaw : 1;

    let okxSellResult: any = null;

    try {
      // 1) Transferir USDT da conta funding para trading
      await this.okxService.transferUsdtToTrading(usdtAmount);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2) Vender USDT na OKX e verificar BRL recebido
      okxSellResult = await this.okxService.sellAndCheckHistory(usdtAmount);

      const brlFromExchange = okxSellResult.brlReceived;
      if (brlFromExchange <= 0) {
        throw new Error('Não foi possível determinar o valor em BRL recebido');
      }

      // 3) Aplicar spread (cliente recebe menos)
      const brlToCredit = Number((brlFromExchange * spreadRate).toFixed(2));
      const spreadAmount = Number((brlFromExchange - brlToCredit).toFixed(2));

      // 4) Creditar BRL na conta do cliente
      const balanceBefore = Number(account.balance);
      const balanceAfter = balanceBefore + brlToCredit;

      await this.prisma.account.update({
        where: { id: account.id },
        data: { balance: balanceAfter.toFixed(2) },
      });

      // 5) Registrar transação CONVERSION (USDT→BRL)
      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.CONVERSION,
          status: 'COMPLETED',
          amount: brlToCredit,
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
          description: `Conversão USDT→BRL: ${usdtAmount.toFixed(2)} USDT → R$ ${brlToCredit.toFixed(2)}`,
          externalId: `CONV-SELL-${Date.now()}`,
          externalData: {
            direction: 'USDT_TO_BRL',
            usdtSold: usdtAmount,
            brlFromExchange,
            brlCredited: brlToCredit,
            okxSellResult,
            spread: { 
              exchangedBrl: brlFromExchange, 
              creditedBrl: brlToCredit, 
              spreadBrl: spreadAmount, 
              spreadRate 
            },
          },
          completedAt: new Date(),
        },
      });

      return {
        message: 'Venda de USDT concluída',
        usdtSold: usdtAmount,
        brlFromExchange,
        brlCredited: brlToCredit,
        spread: {
          exchangedBrl: brlFromExchange,
          creditedBrl: brlToCredit,
          spreadBrl: spreadAmount,
          spreadRate,
        },
        okxSellResult,
        newBalance: balanceAfter.toFixed(2),
      };
    } catch (error) {
      throw error;
    }
  }

  async setOkxWhitelisted(walletId: string, customerId: string, whitelisted: boolean) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet não encontrada');
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { okxWhitelisted: whitelisted },
    });
  }
}
