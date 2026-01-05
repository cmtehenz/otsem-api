import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OkxAuthService } from './okx-auth.service';

// Exemplo para extrair saldo USDT
interface OkxBalanceDetail {
    ccy: string;
    availBal: string;
    [key: string]: any;
}

interface OkxBalanceResponse {
    details: OkxBalanceDetail[];
    [key: string]: any;
}

interface OkxApiResponse {
    data: OkxBalanceResponse[];
    [key: string]: any;
}

interface WithdrawUsdtParams {
    currency: string;
    amount: string | number;
    toAddress: string;
    network: string; // exemplo: 'SOL', 'ERC20', 'TRC20'
    fundPwd: string;
    fee: string | number;
}


@Injectable()
export class OkxService {
    private readonly logger = new Logger(OkxService.name);
    
    constructor(private readonly authService: OkxAuthService) { }

    async getAccountBalance() {
        const method = 'GET';
        const requestPath = '/api/v5/account/balance';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, {
            headers,
        });

        const okxData = response.data as OkxApiResponse;
        const details = okxData.data[0]?.details || [];
        const usdt = details.find((d: OkxBalanceDetail) => d.ccy === 'USDT');

        if (usdt) {
            console.log('Saldo USDT:', usdt.availBal);
        } else {
            console.log('USDT balance not found.');
        }

        return response.data;
    }

    async getBrlBalance() {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const brl = details.find((d: any) => d.ccy === 'BRL');
        return brl ? brl.availBal : '0';
    }

    async getUsdtBalance() {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const usdt = details.find((d: any) => d.ccy === 'USDT');
        return usdt ? usdt.availBal : '0';
    }

    async getBrlToUsdtRate(): Promise<number> {
        try {
            const method = 'GET';
            const requestPath = '/api/v5/market/ticker?instId=USDT-BRL';
            const body = '';
            const headers = this.authService.getAuthHeaders(method, requestPath, body);
            const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

            const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
            const ticker = response.data?.data?.[0];
            if (ticker?.last) {
                return parseFloat(ticker.last);
            }
            return 5.5;
        } catch (error) {
            console.error('Erro ao obter taxa BRL/USDT:', error);
            return 5.5;
        }
    }

    async buyUsdtWithBrl(brlAmount: number): Promise<any> {
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const bodyObj = {
            instId: 'USDT-BRL',
            tdMode: 'cash',
            side: 'buy',
            ordType: 'market',
            sz: brlAmount.toString()
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(
            `${apiUrl}${requestPath}`,
            bodyObj,
            { headers }
        );
        return response.data;
    }

    async sellUsdtForBrl(usdtAmount: number): Promise<{
        orderId: string;
        brlReceived: number;
        tradingFee: number;
        fills: any[];
    }> {
        this.logger.log(`[SELL] Vendendo ${usdtAmount} USDT por BRL...`);
        
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const bodyObj = {
            instId: 'USDT-BRL',
            tdMode: 'cash',
            side: 'sell',
            ordType: 'market',
            sz: usdtAmount.toString(),
            tgtCcy: 'base_ccy'
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(
            `${apiUrl}${requestPath}`,
            bodyObj,
            { headers }
        );
        
        const orderId = response.data?.data?.[0]?.ordId;
        if (!orderId) {
            throw new Error('Ordem de venda não criada: ' + JSON.stringify(response.data));
        }
        
        this.logger.log(`[SELL] Ordem criada: ${orderId}`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const fillsResponse = await this.getOrderFills(orderId);
        const fills = fillsResponse || [];
        
        let brlReceived = 0;
        let tradingFee = 0;
        
        for (const fill of fills) {
            const fillSz = parseFloat(fill.fillSz || '0');
            const fillPx = parseFloat(fill.fillPx || '0');
            const fee = parseFloat(fill.fee || '0');
            
            brlReceived += fillSz * fillPx;
            tradingFee += Math.abs(fee);
        }
        
        this.logger.log(`[SELL] Venda concluída: ${usdtAmount} USDT → R$ ${brlReceived.toFixed(2)} (taxa: R$ ${tradingFee.toFixed(2)})`);
        
        return {
            orderId,
            brlReceived,
            tradingFee,
            fills
        };
    }

    async getOrderFills(orderId: string): Promise<any[]> {
        const method = 'GET';
        const requestPath = `/api/v5/trade/fills?ordId=${orderId}&instId=USDT-BRL`;
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }

    async getUsdtBuyHistory(): Promise<any> {
        const method = 'GET';
        const requestPath = '/api/v5/trade/fills';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const params = {
            instId: 'USDT-BRL',
            side: 'buy',
            limit: 20
        };

        // O prehash NÃO inclui query params!
        return axios.get(`${apiUrl}${requestPath}`, {
            headers,
        });
    }

    async buyAndCheckHistory(brlAmount: number): Promise<any> {
        // 1. Comprar USDT com BRL
        const buyResponse = await this.buyUsdtWithBrl(brlAmount);
        const ordId = buyResponse.data[0]?.ordId;
        if (!ordId) {
            throw new Error('Ordem não criada');
        }

        // 2. Aguardar 10 segundos
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Buscar histórico de fills
        const fillsResponse = await this.getUsdtBuyHistory();
        const fills = fillsResponse.data?.data || [];

        // 4. Filtrar pelo ordId
        const detalhes = fills.filter((f: any) => f.ordId === ordId);

        return {
            ordId,
            detalhes
        };
    }

    async withdrawUsdt({
        amount,
        toAddress,
        network,
        fundPwd,
        fee
    }: WithdrawUsdtParams) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/withdrawal';
        const bodyObj = {
            ccy: 'USDT',
            amt: amount,
            dest: 4,
            toAddr: toAddress,
            chain: `USDT-${network}`,
            fee: fee,
            pwd: fundPwd
        };
        const body = JSON.stringify(bodyObj);

        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const url = `https://www.okx.com${requestPath}`;
        const response = await axios.post(url, bodyObj, { headers });
        return response.data;
    }

    async withdrawUsdtSimple(amount: string, toAddress: string, network: string, fee: string) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/withdrawal';
        const bodyObj = {
            ccy: 'USDT',
            amt: amount,
            dest: 4,
            toAddr: toAddress,
            chain: `USDT-${network}`,
            fee: fee
        };
        const body = JSON.stringify(bodyObj);

        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const url = `https://www.okx.com${requestPath}`;
        const response = await axios.post(url, bodyObj, { headers });
        return response.data;
    }

    async withdrawCrypto({
        currency,
        amount,
        toAddress,
        chain,
        fee
    }: {
        currency: string;
        amount: string;
        toAddress: string;
        chain: string;
        fee: string;
    }) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/withdrawal';
        const bodyObj = {
            ccy: currency,
            amt: amount,
            dest: 4,
            toAddr: toAddress,
            chain: chain,
            fee: fee
        };
        const body = JSON.stringify(bodyObj);

        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const url = `https://www.okx.com${requestPath}`;
        const response = await axios.post(url, bodyObj, { headers });
        return response.data;
    }

    async getWithdrawalFee(currency: string, chain: string) {
        const method = 'GET';
        const requestPath = `/api/v5/asset/currencies?ccy=${currency}`;
        const headers = this.authService.getAuthHeaders(method, requestPath, '');

        const url = `https://www.okx.com${requestPath}`;
        const response = await axios.get(url, { headers });
        
        const currencies = response.data?.data || [];
        const chainData = currencies.find((c: any) => c.chain === chain);
        return chainData?.minFee || '0';
    }

    async buyCryptoWithUsdt(crypto: string, usdtAmount: number): Promise<any> {
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const instId = `${crypto}-USDT`;
        const bodyObj = {
            instId: instId,
            tdMode: 'cash',
            side: 'buy',
            ordType: 'market',
            sz: usdtAmount.toString(),
            tgtCcy: 'quote_ccy'
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`📈 Comprando ${crypto} com ${usdtAmount} USDT...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async getCryptoBalance(currency: string): Promise<string> {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const crypto = details.find((d: any) => d.ccy === currency);
        return crypto ? crypto.availBal : '0';
    }

    async transferCryptoToFunding(currency: string, amount: string): Promise<any> {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: currency,
            amt: amount,
            from: '18',
            to: '6'
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`💱 Transferindo ${amount} ${currency} para funding...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async buyBrlAndReturnUsdtBalance(brlAmount: number) {
        await this.buyUsdtWithBrl(brlAmount);
        // Aguarda alguns segundos para a ordem ser processada
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.getUsdtBalance();
    }

    async buyUsdtWithBrlIfEnough(brlAmount: number): Promise<any> {
        const brlBalance = parseFloat(await this.getBrlBalance());
        if (brlAmount > brlBalance) {
            throw new Error(`Saldo insuficiente de BRL. Saldo disponível: ${brlBalance}`);
        }
        return this.buyUsdtWithBrl(brlAmount);
    }

    /**
     * Transfere BRL da conta funding (principal) para a conta trading.
     * @param amount Valor em BRL a transferir (string ou number)
     */
    async transferBrlToTrading(amount: string | number) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: 'BRL',
            amt: amount.toString(),
            from: 18,   // 6 = funding
            to: 6     // 18 = trading
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async safeWithdrawUsdt(params: WithdrawUsdtParams) {
        // 2. Transfere USDT da conta trading para funding
        await this.transferFromTradingToFunding(params.currency, params.amount);

        // 3. Aguarda alguns segundos para garantir o processamento
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Realiza o saque normalmente
        return this.withdrawUsdt(params);
    }

    /**
     * Transfere USDT da conta funding para trading.
     * @param amount Valor em USDT a transferir
     */
    async transferUsdtToTrading(amount: string | number) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: 'USDT',
            amt: amount.toString(),
            from: 6,   // 6 = funding
            to: 18     // 18 = trading
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async getTradingBalanceByCurrency(currency: string) {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const asset = details.find((d: any) => d.ccy === currency);
        return asset ? asset.availBal : '0';
    }

    async transferFromTradingToFunding(currency: string, amount: string | number) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: currency,
            amt: amount.toString(),
            from: 18, // trading
            to: 6     // funding
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async getFundingBalance(currency: string) {
        const method = 'GET';
        const requestPath = '/api/v5/asset/balances';
        const headers = this.authService.getAuthHeaders(method, requestPath, '');
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        const balances = response.data?.data || [];
        const asset = balances.find((b: any) => b.ccy === currency);
        return asset ? asset.availBal : '0';
    }

    async getAllFundingBalances() {
        const method = 'GET';
        const requestPath = '/api/v5/asset/balances';
        const headers = this.authService.getAuthHeaders(method, requestPath, '');
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        const balances = response.data?.data || [];
        return balances
            .filter((b: any) => parseFloat(b.availBal) > 0)
            .map((b: any) => ({
                currency: b.ccy,
                available: b.availBal,
                frozen: b.frozenBal
            }));
    }

    async getAllTradingBalances() {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        return details
            .filter((d: any) => parseFloat(d.availBal) > 0)
            .map((d: any) => ({
                currency: d.ccy,
                available: d.availBal,
                frozen: d.frozenBal
            }));
    }

    /**
     * Busca histórico de vendas de USDT
     */
    async getUsdtSellHistory(): Promise<any> {
        const method = 'GET';
        const requestPath = '/api/v5/trade/fills';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        return axios.get(`${apiUrl}${requestPath}`, {
            headers,
        });
    }

    /**
     * Vende USDT e retorna detalhes da ordem (BRL recebido)
     */
    async sellAndCheckHistory(usdtAmount: number): Promise<{ ordId: string; detalhes: any[]; brlReceived: number }> {
        const result = await this.sellUsdtForBrl(usdtAmount);
        
        const fillsResponse = await this.getUsdtSellHistory();
        const fills = fillsResponse.data?.data || [];
        const detalhes = fills.filter((f: any) => f.ordId === result.orderId);

        return {
            ordId: result.orderId,
            detalhes,
            brlReceived: result.brlReceived
        };
    }

    /**
     * Obtém endereço de depósito USDT para uma rede específica
     * @param network 'Solana' | 'TRC20' (Tron)
     */
    async getDepositAddress(network: 'Solana' | 'TRC20'): Promise<{ address: string; chain: string; memo?: string }> {
        const method = 'GET';
        const requestPath = `/api/v5/asset/deposit-address?ccy=USDT`;
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        const addresses = response.data?.data || [];

        const chainMap: Record<string, string> = {
            'Solana': 'USDT-Solana',
            'TRC20': 'USDT-TRC20'
        };

        const targetChain = chainMap[network];
        const found = addresses.find((a: any) => a.chain === targetChain);

        if (!found) {
            throw new Error(`Endereço de depósito não encontrado para ${network}`);
        }

        return {
            address: found.addr,
            chain: found.chain,
            memo: found.memo || undefined
        };
    }

    /**
     * Lista depósitos recentes de USDT
     */
    async getRecentDeposits(): Promise<any[]> {
        const method = 'GET';
        const requestPath = '/api/v5/asset/deposit-history?ccy=USDT';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }

    /**
     * Lista saques recentes de USDT
     */
    async getRecentWithdrawals(): Promise<any[]> {
        const method = 'GET';
        const requestPath = '/api/v5/asset/withdrawal-history?ccy=USDT';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }

    /**
     * Obtém histórico completo de trades (fills)
     */
    async getTradeHistory(): Promise<any[]> {
        const method = 'GET';
        const requestPath = '/api/v5/trade/fills';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }
}