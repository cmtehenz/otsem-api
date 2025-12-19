import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { PixKeyType } from '../inter/dto/send-pix.dto';
import { OkxService } from '../okx/services/okx.service';
import { WalletNetwork, TransactionType } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interPixService: InterPixService,
    private readonly okxService: OkxService,
  ) { }

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
      // 1) PIX para conta OKX (com tipo CONVERSION)
      pixResult = await this.interPixService.sendPix(customerId, {
        valor: brlAmount,
        chaveDestino: '50459025000126',
        tipoChave: PixKeyType.CHAVE,
        descricao: `Conversão BRL→USDT - ${customerId}`,
        transactionType: TransactionType.CONVERSION,
      });
      stages.pixTransfer = 'done';

      // 2) Compra USDT na OKX
      await new Promise((resolve) => setTimeout(resolve, 5000));
      okxBuyResult = await this.okxService.buyUsdtWithBrl(brlToExchange);
      stages.conversion = 'done';

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
        wallet = await this.getMainWallet(customerId, 'SOLANA');
      }

      if (!wallet || !wallet.externalAddress) {
        throw new Error('Carteira Solana não encontrada para o cliente');
      }

      withdrawResult = await this.okxService.safeWithdrawUsdt({
        currency: 'USDT',
        amount: okxBuyResult.amount || brlAmount,
        toAddress: wallet.externalAddress,
        network: 'Solana',
        fundPwd: process.env.OKX_API_PASSPHRASE || 'not_found',
        fee: '1',
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
}
