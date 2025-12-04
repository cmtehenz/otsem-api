import { Injectable } from '@nestjs/common';
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
}