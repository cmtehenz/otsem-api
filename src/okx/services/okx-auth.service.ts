import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class OkxAuthService {
    constructor(private readonly config: ConfigService) { }

    getCredentials() {
        return {
            apiKey: this.config.get<string>('okx.apiKey')?.trim(),
            apiSecret: this.config.get<string>('okx.apiSecret')?.trim(),
            passphrase: this.config.get<string>('okx.passphrase')?.trim(),
        };
    }

    signRequest(timestamp: string, method: string, requestPath: string, body: string): string {
        const { apiSecret } = this.getCredentials();
        if (!apiSecret) {
            throw new Error('OKX API Secret is not defined');
        }
        const prehash = timestamp + method.toUpperCase() + requestPath + body;
        console.log('OKX prehash:', prehash); // Adicione este log
        const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');
        console.log('OKX sign:', sign); // Adicione este log
        return sign;
    }

    getAuthHeaders(method: string, requestPath: string, body: string): Record<string, string> {
        const timestamp = new Date().toISOString();
        const { apiKey, apiSecret, passphrase } = this.getCredentials();

        if (!apiKey || !apiSecret || !passphrase) {
            throw new Error('OKX credentials are not fully defined');
        }

        const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
        const sign = crypto.createHmac('sha256', apiSecret)
            .update(prehash)
            .digest('base64');
        return {
            'OK-ACCESS-KEY': apiKey,
            'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': passphrase,
            'Content-Type': 'application/json'
        };
    }
}