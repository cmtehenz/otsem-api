import { Injectable } from '@nestjs/common';
import { OkxAuthService } from './okx-auth.service';
import axios from 'axios';

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
}