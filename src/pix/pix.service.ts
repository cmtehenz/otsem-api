import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrxAuthService } from '../brx/brx-auth.service';
import type { AxiosError } from 'axios';
import { BrxListKeysRaw, ListKeysResponseDto } from './dtos/list-keys.dto';

@Injectable()
export class PixService {
    private readonly baseUrl: string;

    constructor(
        private readonly http: HttpService,
        private readonly brxAuth: BrxAuthService,
    ) {
        this.baseUrl = process.env.BRX_BASE_URL ?? 'https://apisbank.brxbank.com.br';
    }

    async listKeys(accountHolderId: string): Promise<ListKeysResponseDto> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}`;

        try {
            const resp = await firstValueFrom(
                this.http.get<BrxListKeysRaw>(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }),
            );

            const raw = resp.data;

            const bank = raw?.extensions?.data?.bank
                ? {
                    name: raw.extensions.data.bank.name ?? null,
                    ispb: raw.extensions.data.bank.ispb ?? null,
                    code: raw.extensions.data.bank.code ?? null,
                }
                : null;

            const keys =
                raw?.extensions?.data?.keys?.map((k) => ({
                    key: k.key,
                    keyType: k.keyType,
                    keyTypeId: k.keyTypeId,
                    account: k.account
                        ? {
                            branch: k.account.branch,
                            number: k.account.number,
                            type: k.account.type,
                            typeId: k.account.typeId,
                        }
                        : undefined,
                })) ?? [];

            return { bank, keys, message: raw?.extensions?.message };
        } catch (err) {
            const ax = err as AxiosError<{ message?: string }>;
            const msg = ax.response?.data?.message ?? ax.message ?? 'Erro BRX';
            throw new HttpException(msg, ax.response?.status ?? 502);
        }
    }
}
