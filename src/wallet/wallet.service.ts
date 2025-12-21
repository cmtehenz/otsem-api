import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { PixKeyType } from '../inter/dto/send-pix.dto';
import { OkxService } from '../okx/services/okx.service';
import { TronService } from '../tron/tron.service';
import { WalletNetwork, TransactionType } from '@prisma/client';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interPixService: InterPixService,
    private readonly okxService: OkxService,
    private readonly tronService: TronService,
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

  async buyUsdtWithBrl(customerId: string, brlAmount: number, walletId?: string) {
    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account || Number(account.balance) < brlAmount || brlAmount < 10) {
      throw new Error('Saldo insuficiente em BRL (mínimo R$10)');
    }

    // Spread configurável por usuário (default: 1.0 = sem spread). Campo está em User.spreadValue
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } } },
    });
    const spreadRateRaw = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const spreadRate = Number.isFinite(spreadRateRaw) && spreadRateRaw > 0 ? spreadRateRaw : 1;

    const brlToExchange = Number((brlAmount * spreadRate).toFixed(2));
    const spreadAmount = Number((brlAmount - brlToExchange).toFixed(2));

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

      // 3) Registrar transação CONVERSION separada
      const balanceBefore = account.balance;
      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.CONVERSION,
          status: 'COMPLETED',
          amount: brlAmount,
          balanceBefore,
          balanceAfter: balanceBefore,
          description: `Conversão BRL→USDT: R$ ${brlAmount.toFixed(2)} → ${usdtAmount.toFixed(2)} USDT`,
          externalId: pixResult?.endToEndId || `CONV-${Date.now()}`,
          externalData: {
            pixEndToEnd: pixResult?.endToEndId,
            okxBuyResult,
            usdtAmount,
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

      // 3) Transferência USDT para carteira do cliente
      let wallet;
      if (walletId) {
        wallet = await this.getWalletById(walletId, customerId);
      } else {
        // Tentar Solana primeiro, depois Tron
        wallet = await this.getMainWallet(customerId, 'SOLANA');
        if (!wallet) {
          wallet = await this.getMainWallet(customerId, 'TRON');
        }
      }

      if (!wallet || !wallet.externalAddress) {
        throw new Error('Carteira (Solana ou Tron) não encontrada para o cliente');
      }

      // Determinar rede e taxa
      const isTron = wallet.network === 'TRON';
      const networkFee = 1; // 1 USDT para ambas as redes
      const usdtToWithdraw = usdtAmount - networkFee;
      if (usdtToWithdraw <= 0) {
        throw new Error(`Quantidade de USDT insuficiente para saque. Comprado: ${usdtAmount}, taxa: ${networkFee}`);
      }

      // OKX → Cliente direto (Solana ou Tron)
      const network = isTron ? 'TRC20' : 'Solana';
      this.logger.log(`[${network}] Sacando ${usdtToWithdraw} USDT para: ${wallet.externalAddress}`);

      withdrawResult = await this.okxService.withdrawUsdt({
        currency: 'USDT',
        amount: usdtToWithdraw.toFixed(2),
        toAddress: wallet.externalAddress,
        network,
        fundPwd: process.env.OKX_API_PASSPHRASE || 'not_found',
        fee: networkFee.toString(),
      });
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
        },
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
}
