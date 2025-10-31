import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface BrxTokenResponse {
    access_token: string;
    expires_in: number; // normalmente 300 segundos
    token_type: string;
    scope: string;
}

@Injectable()
export class BrxAuthService {
    private readonly logger = new Logger(BrxAuthService.name);
    private readonly tokenUrl = process.env.BRX_TOKEN_URL ?? 'https://token.brxbank.com.br/oauth2/token';
    private readonly clientId = process.env.BRX_CLIENT_ID!;
    private readonly clientSecret = process.env.BRX_CLIENT_SECRET!;
    private readonly scope = process.env.BRX_SCOPE ?? 'clients_api/big_pix';

    private cachedToken: string | null = null;
    private expiresAt = 0; // timestamp em ms

    constructor(private readonly http: HttpService) { }

    private buildBasicAuth(): string {
        const raw = `${this.clientId}:${this.clientSecret}`;
        return Buffer.from(raw).toString('base64');
    }

    private isTokenValid(): boolean {
        // margem de segurança de 20s
        return !!this.cachedToken && Date.now() < this.expiresAt - 20_000;
    }

    async getAccessToken(): Promise<string> {
        if (this.isTokenValid()) return this.cachedToken!;

        const headers = {
            Authorization: `Basic ${this.buildBasicAuth()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            scope: this.scope,
        });

        try {
            const res = await firstValueFrom(
                this.http.post<BrxTokenResponse>(this.tokenUrl, body.toString(), { headers }),
            );

            const token = res.data.access_token;
            const expiresIn = res.data.expires_in ?? 300;
            this.cachedToken = token;
            this.expiresAt = Date.now() + expiresIn * 1000;

            this.logger.log(`Novo token BRX obtido. Expira em ${expiresIn}s.`);
            return token;
        } catch (e) {
            this.logger.error(`Falha ao gerar token BRX: ${e}`);
            throw e;
        }
    }
}
