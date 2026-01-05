import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import bs58 from 'bs58';

const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;
  private hotWallet: Keypair | null = null;
  private hotWalletAddress: string;

  constructor(private configService: ConfigService) {
    this.hotWalletAddress = this.configService.get<string>('OKX_SOLANA_DEPOSIT_ADDRESS') || '';
  }

  async onModuleInit() {
    this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    
    const privateKeyRaw = this.configService.get<string>('SOLANA_HOT_WALLET_PRIVATE_KEY');
    const privateKey = privateKeyRaw?.trim();
    
    if (privateKey) {
      try {
        this.logger.log(`🔑 Tentando decodificar chave Solana (${privateKey.length} chars)`);
        
        let decoded: Uint8Array;
        
        if (privateKey.length === 128 && /^[0-9a-fA-F]+$/.test(privateKey)) {
          this.logger.log('🔑 Formato detectado: HEX (128 chars)');
          decoded = Uint8Array.from(Buffer.from(privateKey, 'hex'));
        } else if (privateKey.length === 88 || privateKey.length === 87) {
          this.logger.log('🔑 Formato detectado: Base58');
          decoded = bs58.decode(privateKey);
        } else {
          decoded = bs58.decode(privateKey);
        }
        
        this.logger.log(`🔑 Decoded ${decoded.length} bytes`);
        this.hotWallet = Keypair.fromSecretKey(decoded);
        this.hotWalletAddress = this.hotWallet.publicKey.toBase58();
        this.logger.log(`✅ Solana hot wallet inicializada: ${this.hotWalletAddress}`);
      } catch (error: any) {
        this.logger.error(`❌ Erro ao inicializar hot wallet Solana: ${error.message}`);
        this.logger.error(`❌ Primeiros 10 chars: ${privateKey.substring(0, 10)}...`);
      }
    } else {
      this.logger.warn('⚠️ Solana hot wallet não configurada - apenas leitura');
    }
  }

  getHotWalletAddress(): string {
    return this.hotWalletAddress;
  }

  async getSolBalance(address: string): Promise<number> {
    try {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar saldo SOL: ${error.message}`);
      return 0;
    }
  }

  async getUsdtBalance(address: string): Promise<number> {
    try {
      const pubkey = new PublicKey(address);
      const ata = await splToken.getAssociatedTokenAddress(USDT_MINT, pubkey);
      const account = await splToken.getAccount(this.connection, ata);
      return Number(account.amount) / 1_000_000;
    } catch (error: any) {
      if (error.message?.includes('could not find account')) {
        return 0;
      }
      this.logger.error(`Erro ao buscar saldo USDT: ${error.message}`);
      return 0;
    }
  }

  async getHotWalletSolBalance(): Promise<number> {
    if (!this.hotWalletAddress) return 0;
    return this.getSolBalance(this.hotWalletAddress);
  }

  async getHotWalletUsdtBalance(): Promise<number> {
    if (!this.hotWalletAddress) return 0;
    return this.getUsdtBalance(this.hotWalletAddress);
  }

  async sendSol(toAddress: string, amount: number): Promise<{ txId: string; success: boolean }> {
    if (!this.hotWallet) {
      throw new Error('Hot wallet Solana não configurada');
    }

    try {
      const toPubkey = new PublicKey(toAddress);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hotWallet.publicKey,
          toPubkey,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hotWallet]
      );

      this.logger.log(`✅ SOL enviado: ${amount} para ${toAddress}, tx: ${signature}`);

      return {
        txId: signature,
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar SOL: ${error.message}`);
      throw error;
    }
  }

  async isValidAddress(address: string): Promise<boolean> {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async getTransactionStatus(signature: string): Promise<'confirmed' | 'finalized' | 'failed' | 'pending'> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      if (!status.value) return 'pending';
      if (status.value.err) return 'failed';
      if (status.value.confirmationStatus === 'finalized') return 'finalized';
      if (status.value.confirmationStatus === 'confirmed') return 'confirmed';
      return 'pending';
    } catch {
      return 'pending';
    }
  }

  async getAssociatedTokenAddress(walletAddress: string): Promise<string> {
    const pubkey = new PublicKey(walletAddress);
    const ata = await splToken.getAssociatedTokenAddress(USDT_MINT, pubkey);
    return ata.toBase58();
  }

  async checkAtaExists(walletAddress: string): Promise<boolean> {
    try {
      const pubkey = new PublicKey(walletAddress);
      const ata = await splToken.getAssociatedTokenAddress(USDT_MINT, pubkey);
      await splToken.getAccount(this.connection, ata);
      return true;
    } catch {
      return false;
    }
  }

  getUsdtMint(): string {
    return USDT_MINT.toBase58();
  }
}
