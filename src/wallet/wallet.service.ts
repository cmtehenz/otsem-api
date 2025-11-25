import { Injectable } from '@nestjs/common';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { PrismaService } from '../prisma/prisma.service'; // ajuste o import conforme seu projeto

@Injectable()
export class WalletService {
    constructor(private readonly prisma: PrismaService) { }

    async createSolanaWalletForCustomer(customerId: string) {
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const secretKey = Buffer.from(keypair.secretKey).toString('hex');

        // Desmarca todas as wallets USDT do cliente como principal
        await this.prisma.wallet.updateMany({
            where: { customerId, currency: 'USDT', isMain: true },
            data: { isMain: false }
        });

        // Cria ou atualiza a wallet principal
        const wallet = await this.prisma.wallet.upsert({
            where: { customerId_currency: { customerId, currency: 'USDT' } },
            update: {
                externalAddress: publicKey,
                isMain: true,
                balance: 0
            },
            create: {
                customerId,
                currency: 'USDT',
                balance: 0,
                externalAddress: publicKey,
                isMain: true
            }
        });

        return {
            publicKey,
            secretKey,
            wallet
        };
    }

    async getSolanaUsdtBalance(address: string, customerId?: string): Promise<string> {
        try {
            const connection = new Connection('https://api.mainnet-beta.solana.com');
            const usdtMint = new PublicKey('Es9vMFrzaCERcKjQ6tG1pQ6v5yF7z4d6h6t6z6t6z6t6');
            let owner: PublicKey;
            try {
                owner = new PublicKey(address);
            } catch {
                throw new Error('Endereço Solana inválido');
            }

            const tokenAccounts = await connection.getTokenAccountsByOwner(owner, { mint: usdtMint });
            let saldo = '0';
            if (tokenAccounts.value.length > 0) {
                const accountInfo = await connection.getParsedAccountInfo(tokenAccounts.value[0].pubkey);
                const data = accountInfo.value?.data;
                if (typeof data === 'object' && 'parsed' in data) {
                    const parsed = (data as any).parsed?.info?.tokenAmount?.amount;
                    if (parsed) saldo = (Number(parsed) / 1e6).toString();
                }
            }

            // Atualiza o saldo no banco se customerId for informado
            if (customerId) {
                await this.prisma.wallet.updateMany({
                    where: {
                        customerId,
                        currency: 'USDT',
                        externalAddress: address
                    },
                    data: {
                        balance: saldo
                    }
                });
            }

            return saldo;
        } catch (err) {
            if (err.message === 'Endereço Solana inválido') throw err;
            return '0';
        }
    }

    async getAllUsdtWalletsForCustomer(customerId: string) {
        return await this.prisma.wallet.findMany({
            where: {
                customerId,
                currency: 'USDT'
            }
        });
    }
}