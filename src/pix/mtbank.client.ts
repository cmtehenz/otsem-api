import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MtBankClient {
    private http = axios.create({
        baseURL: process.env.MTBANK_BASE_URL,
        timeout: 15000,
    });

    // Exemplo de chamada para criar um PIX de saída (ajuste para o contrato real do banco)
    async createPixOut(payload: {
        amount: number;
        pixKey: string;
        pixKeyType: string;
        beneficiaryName: string;
        beneficiaryTaxNumber: string;
        requestId: string;
    }) {
        // se precisa token OAuth, adicione aqui antes (pega token e seta Authorization)
        // const token = await this.getToken();
        // this.http.defaults.headers.common.Authorization = `Bearer ${token}`;

        // Exemplo de rota/forma. Troque conforme a documentação do banco.
        const res = await this.http.post('/pix/cash-out', payload);
        return res.data; // ideal retornar { endToEndId, status, ... }
    }
}
