import { Injectable } from '@nestjs/common';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, AccountInfo } from '@solana/spl-token';

@Injectable()
export class WalletService {
    createSolanaWallet() {
        const keypair = Keypair.generate();
        return {
            publicKey: keypair.publicKey.toBase58(),
            secretKey: Buffer.from(keypair.secretKey).toString('hex')
        };
    }

    async getSolanaUsdtBalance(address: string): Promise<string> {
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
            if (tokenAccounts.value.length === 0) return '0';

            const accountInfo = await connection.getParsedAccountInfo(tokenAccounts.value[0].pubkey);
            const data = accountInfo.value?.data;

            if (typeof data === 'object' && 'parsed' in data) {
                const parsed = (data as any).parsed?.info?.tokenAmount?.amount;
                if (!parsed) return '0';
                return (Number(parsed) / 1e6).toString();
            }

            return '0';
        } catch (err) {
            // Só lança erro se o endereço for inválido
            if (err.message === 'Endereço Solana inválido') throw err;
            // Para qualquer outro erro, retorna saldo zero
            return '0';
        }
    }
}