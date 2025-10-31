// src/pix/dtos/list-keys.dto.ts

export interface BrxBankDto {
    Name: string;
    Ispb: string;
    Code: string | null;
}

export interface BrxAccountDto {
    Branch: string;
    Number: string;
    Type: string;
    TypeId: number;
}

export interface BrxKeyDto {
    Key: string;        // <- atenção: na doc está "Keys", mas nos exemplos/uso costuma ser "Key"
    KeyType: string;
    KeyTypeId: number;
    Account?: BrxAccountDto;
}

// Resposta bruta padrão da BRX (conforme os exemplos que você recebeu)
export interface BrxListKeysRaw {
    statusCode?: number;
    title?: string;
    type?: string;
    extensions?: {
        data?: {
            bank?: {
                name?: string;
                ispb?: string;
                code?: string | null;
            };
            keys?: Array<{
                key: string;
                keyType: string;
                keyTypeId: number;
                account?: {
                    branch: string;
                    number: string;
                    type: string;
                    typeId: number;
                };
            }>;
        };
        message?: string;
        errors?: unknown;
    };
}

/** DTO "normalizado" para o seu backend */
export interface ListKeysResponseDto {
    bank: {
        name: string | null;
        ispb: string | null;
        code: string | null;
    } | null;
    keys: Array<{
        key: string;
        keyType: string;
        keyTypeId: number;
        account?: {
            branch: string;
            number: string;
            type: string;
            typeId: number;
        };
    }>;
    message?: string;
}
