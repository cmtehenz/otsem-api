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
            let owner: PublicKey;
            try {
                owner = new PublicKey(address);
            } catch {
                throw new Error('Endereço Solana inválido');
            }

            // Busca todas as contas de token do endereço
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                owner,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            let saldo = 0;
            for (const acc of tokenAccounts.value) {
                const info = acc.account.data.parsed.info;
                console.log('Token encontrado:', info.mint, 'Saldo:', info.tokenAmount.amount);
                // Mint USDT SPL (corrigido para o mint completo)
                if (info.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
                    saldo += Number(info.tokenAmount.amount);
                }
            }
            const saldoUsdt = (saldo / 1e6).toString();
            console.log('Saldo total USDT:', saldoUsdt);

            if (customerId) {
                await this.prisma.wallet.updateMany({
                    where: {
                        customerId,
                        currency: 'USDT',
                        externalAddress: address
                    },
                    data: {
                        balance: saldoUsdt
                    }
                });
            }

            return saldoUsdt;
        } catch (err) {
            if (err.message === 'Endereço Solana inválido') throw err;
            console.error('Erro ao consultar saldo USDT:', err);
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