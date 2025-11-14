import { PixReceived } from '../types/pix-received.type';

export class PixReceivedDto implements PixReceived {
    e2eId: string;
    txid: string;
    valor: number;
    horario: string;
    chave: string;
    pagador?: {
        nome?: string;
        cpfCnpj?: string;
    };
}