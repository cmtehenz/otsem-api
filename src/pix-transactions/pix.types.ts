export type QrCodeFormat = 'copy-paste' | 'image' | 'both';

export interface QrCodeReturn {
    PixCopyPaste: string | null;
    Image?: string | null; // base64
}

export interface StaticQrRequest {
    pixKey: string;
    value?: number;          // em reais (>= 0) — opcional
    message?: string;        // até 140 chars
    format?: QrCodeFormat;   // default: 'both'
}

export interface StaticQrResult {
    identifier: string;
    pixKey: string;
    value: number | null;
    message: string | null;
    format: QrCodeFormat;
    copyPaste?: string | null;
    imageBase64?: string | null;
}
