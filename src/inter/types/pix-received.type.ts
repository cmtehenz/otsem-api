export type PixReceived = {
    e2eId: string;
    txid: string;
    valor: number;
    horario: string;
    chave: string;
    pagador?: {
        nome?: string;
        cpfCnpj?: string;
    };
};