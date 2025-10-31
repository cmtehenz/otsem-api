// Resposta BRX (bruta)
export interface BrxPrecheckRaw {
    StatusCode?: number;
    Title?: string;
    Type?: string;
    Extensions?: {
        Data?: {
            Name: string;
            TaxNumber: string;
            Key: string;
            KeyType: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random' | string;
            KeyTypeId: 1 | 2 | 3 | 4 | 5 | number;
            BankData?: {
                Ispb: string;
                Name: string;
                BankCode: string | null;
                Branch: string;
                Account: string;
                AccountType: 'checking' | 'payment' | 'saving' | 'salary' | string;
                AccountTypeId: number;
            };
            EndToEnd: string;
        };
        Message?: string;
    };
}

// Resposta normalizada do seu backend
export interface PrecheckKeyResponseDto {
    name: string;
    taxNumber: string;
    key: string;
    keyType: string;
    keyTypeId: number;
    bankData?: {
        ispb: string;
        name: string;
        bankCode: string | null;
        branch: string;
        account: string;
        accountType: string;
        accountTypeId: number;
    };
    endToEnd: string;
    message?: string;
}
