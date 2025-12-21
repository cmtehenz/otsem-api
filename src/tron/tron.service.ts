import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

@Injectable()
export class TronService implements OnModuleInit {
    private readonly logger = new Logger(TronService.name);
    private tronWeb: any;
    private hotWalletAddress: string;
    private initialized = false;

    constructor(private configService: ConfigService) {
        this.hotWalletAddress = this.configService.get<string>('OKX_TRON_DEPOSIT_ADDRESS') || 'TLtccxekdFJ6Qjy8yAEBuiv5BM7uk4iepr';
    }

    async onModuleInit() {
        await this.initTronWeb();
    }

    private async initTronWeb() {
        if (this.initialized) return;

        const TronWebModule = require('tronweb');
        const TronWebClass = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;

        const privateKey = this.configService.get<string>('TRON_HOT_WALLET_PRIVATE_KEY');

        if (privateKey) {
            this.tronWeb = new TronWebClass({
                fullHost: 'https://api.trongrid.io',
                privateKey: privateKey
            });
            this.logger.log('✅ TronWeb inicializado com hot wallet');
        } else {
            this.tronWeb = new TronWebClass({
                fullHost: 'https://api.trongrid.io'
            });
            this.logger.warn('⚠️ TronWeb sem private key - apenas leitura');
        }

        this.initialized = true;
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initTronWeb();
        }
    }

    getHotWalletAddress(): string {
        return this.hotWalletAddress;
    }

    async createWallet(): Promise<{ address: string; privateKey: string }> {
        await this.ensureInitialized();
        try {
            // TronWeb 6.x usa utils.accounts.generateAccount()
            if (this.tronWeb.utils && this.tronWeb.utils.accounts && this.tronWeb.utils.accounts.generateAccount) {
                const account = this.tronWeb.utils.accounts.generateAccount();
                return {
                    address: account.address.base58,
                    privateKey: account.privateKey
                };
            }
            
            // Fallback: método antigo createAccount()
            const account = await this.tronWeb.createAccount();
            return {
                address: account.address?.base58 || account.address,
                privateKey: account.privateKey
            };
        } catch (error: any) {
            this.logger.error(`Erro ao criar carteira Tron: ${error.message}`);
            throw new Error(`Falha ao criar carteira Tron: ${error.message}`);
        }
    }

    async isValidAddress(address: string): Promise<boolean> {
        await this.ensureInitialized();
        return this.tronWeb.isAddress(address);
    }

    async getTrxBalance(address: string): Promise<number> {
        await this.ensureInitialized();
        const balance = await this.tronWeb.trx.getBalance(address);
        return balance / 1_000_000;
    }

    async getUsdtBalance(address: string): Promise<number> {
        await this.ensureInitialized();
        
        // Method 1: Use TronGrid triggerconstantcontract API (most reliable)
        try {
            const addressHex = this.tronWeb.address.toHex(address).replace(/^41/, '');
            const parameter = '0000000000000000000000' + addressHex;
            
            const response = await fetch('https://api.trongrid.io/wallet/triggerconstantcontract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_address: USDT_TRC20_CONTRACT,
                    function_selector: 'balanceOf(address)',
                    parameter: parameter,
                    owner_address: address,
                    visible: true
                })
            });
            
            if (response.ok) {
                const data = await response.json() as { constant_result?: string[] };
                if (data.constant_result && data.constant_result[0]) {
                    const balanceHex = data.constant_result[0];
                    const balance = parseInt(balanceHex, 16);
                    return balance / 1_000_000;
                }
            }
        } catch (error: any) {
            this.logger.warn(`TronGrid API falhou: ${error.message}, tentando TronWeb...`);
        }

        // Method 2: Fallback to TronWeb contract call
        try {
            const contract = await this.tronWeb.contract().at(USDT_TRC20_CONTRACT);
            const balance = await contract.balanceOf(address).call();
            return Number(balance) / 1_000_000;
        } catch (error: any) {
            this.logger.error(`Erro ao buscar saldo USDT: ${error.message}`);
            return 0;
        }
    }

    async getHotWalletUsdtBalance(): Promise<number> {
        return this.getUsdtBalance(this.hotWalletAddress);
    }

    async getHotWalletTrxBalance(): Promise<number> {
        return this.getTrxBalance(this.hotWalletAddress);
    }

    async sendUsdt(toAddress: string, amount: number): Promise<{ txId: string; success: boolean }> {
        await this.ensureInitialized();
        const privateKey = this.configService.get<string>('TRON_HOT_WALLET_PRIVATE_KEY');
        if (!privateKey) {
            throw new Error('Hot wallet private key não configurada');
        }

        const isValid = await this.isValidAddress(toAddress);
        if (!isValid) {
            throw new Error('Endereço Tron inválido');
        }

        try {
            const contract = await this.tronWeb.contract().at(USDT_TRC20_CONTRACT);
            const amountInSun = Math.floor(amount * 1_000_000);

            const tx = await contract.transfer(toAddress, amountInSun).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: false
            });

            this.logger.log(`✅ USDT enviado: ${amount} para ${toAddress}, txId: ${tx}`);

            return {
                txId: tx,
                success: true
            };
        } catch (error: any) {
            this.logger.error(`❌ Erro ao enviar USDT: ${error.message}`);
            throw error;
        }
    }

    async getTransactionInfo(txId: string): Promise<any> {
        await this.ensureInitialized();
        try {
            const info = await this.tronWeb.trx.getTransactionInfo(txId);
            return info;
        } catch (error: any) {
            this.logger.error(`Erro ao buscar transação: ${error.message}`);
            return null;
        }
    }

    async isTransactionConfirmed(txId: string): Promise<boolean> {
        const info = await this.getTransactionInfo(txId);
        return info && info.receipt && info.receipt.result === 'SUCCESS';
    }
}
