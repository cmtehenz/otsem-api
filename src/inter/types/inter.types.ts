// src/inter/types/inter.types.ts

export interface InterTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

export interface InterSaldoResponse {
    disponivel: number;
    bloqueadoCheque: number;
    bloqueadoJudicialmente: number;
    bloqueadoAdministrativo: number;
    limite: number;
}

export interface InterTransacao {
    dataEntrada: string;
    tipoTransacao: string;
    tipoOperacao: 'C' | 'D'; // Crédito ou Débito
    valor: number;
    titulo: string;
    descricao?: string;
}

export interface InterExtratoResponse {
    transacoes: InterTransacao[];
}

export interface InterChavePix {
    tipo: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
    chave: string;
}

export interface InterChavesPixResponse {
    chaves: InterChavePix[];
}

export interface InterCobrancaPix {
    txid: string;
    calendario: {
        criacao: string;
        expiracao: number;
    };
    valor: {
        original: string;
    };
    chave: string;
    status: string;
    pixCopiaECola?: string;
    loc?: {
        id: number;
        location: string;
        tipoCob: string;
    };
}

export interface InterWebhook {
    tipo: 'pix' | 'boleto';
    webhookUrl: string;
    criacao: string;
}

export interface InterPixKeyRequest {
    tipoChave: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
    chave?: string; // Obrigatório para CPF, CNPJ, EMAIL, TELEFONE
}

export interface InterPixKeyResponse {
    tipoChave: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
    chave: string;
    conta: {
        agencia: string;
        numeroConta: string;
        tipoConta: string;
    };
    correntista: {
        cpfCnpj: string;
        nome: string;
    };
    dataCriacao: string;
    ativa: boolean;
}

export interface InterPixKeyDeleteResponse {
    mensagem: string;
}