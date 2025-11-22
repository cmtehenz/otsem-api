import { Injectable } from '@nestjs/common';
import { InterAuthService } from './inter-auth.service';

export type PixTestePayload = {
    valor: number;
    dataPagamento?: string;
    descricao?: string;
    destinatario: any;
};

@Injectable()
export class InterPixTesteService {
    constructor(private readonly interAuth: InterAuthService) { }

    async testarEnvioPix({
        payload,
        idIdempotente,
        contaCorrente,
    }: {
        payload: PixTestePayload;
        idIdempotente: string;
        contaCorrente?: string;
    }) {
        const axios = this.interAuth.getAxiosInstance();
        const url = '/banking/v2/pix';

        const headers: any = {
            'x-id-idempotente': idIdempotente,
            'Content-Type': 'application/json',
        };
        if (contaCorrente) {
            headers['x-conta-corrente'] = contaCorrente;
        }

        // Agora o payload já é o body correto
        if (!payload || !payload.valor || !payload.destinatario) {
            throw new Error('Payload inválido: valor e destinatario são obrigatórios');
        }

        try {
            console.log('InterPixTesteService - payload enviado:', payload);
            const response = await axios.post(url, payload, { headers });
            console.log('InterPixTesteService - response:', response.data);
            return response.data;
        } catch (error: any) {
            console.log('InterPixTesteService - erro:', error?.response?.data || error.message);
            throw error;
        }
    }

    // async exemploEnvioPix() {
    //     const axiosInstance = this.interAuth.getAxiosInstance();

    //     const payload = {
    //         valor: 0.13,
    //         descricao: "Pix com chave Pix teste",
    //         destinatario: {
    //             tipo: "CPF",
    //             chave: "04236358913"
    //         }
    //     };

    //     await axiosInstance.post(
    //         '/banking/v2/pix',
    //         payload,
    //         {
    //             headers: {
    //                 'x-id-idempotente': 'c4f3c5e7-7e35-45ec-b37f-581607e8b862'
    //             }
    //         }
    //     );
    // }
}
