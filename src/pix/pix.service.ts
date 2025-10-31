// src/pix/pix.service.ts
import { Injectable, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import type { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { BrxAuthService } from "../brx/brx-auth.service";
import { mapKeyTypeToApi } from "./utils/keytype";
import type { BrxCreateKeyBody, BrxCreateKeyRaw } from "./dtos/create-key.dto";
import type { BrxListKeysRaw, ListKeysResponseDto } from "./dtos/list-keys.dto";
import type { BrxPrecheckRaw, PrecheckKeyResponseDto } from "./dtos/precheck-key.dto";

@Injectable()
export class PixService {
    private readonly baseUrl = process.env.BRX_BASE_URL ?? "https://apisbank.brxbank.com.br";

    constructor(
        private readonly http: HttpService,
        private readonly brxAuth: BrxAuthService,
    ) { }

    async listKeys(accountHolderId: string): Promise<ListKeysResponseDto> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}`;
        try {
            const resp = await firstValueFrom(
                this.http.get<BrxListKeysRaw>(url, {
                    headers: { Authorization: `Bearer ${token}` },
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
                raw?.extensions?.data?.keys?.map(k => ({
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
            const msg = ax.response?.data?.message ?? ax.message ?? "Erro BRX";
            throw new HttpException(msg, ax.response?.status ?? 502);
        }
    }

    async createKey(
        accountHolderId: string,
        input: { keyType: string; pixKey?: string },
    ): Promise<BrxCreateKeyRaw> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}`;

        const keyTypeApi = mapKeyTypeToApi(input.keyType);
        const isRandom = (input.keyType ?? "").toLowerCase() === "random";
        const body = isRandom
            ? { KeyType: "random" } // aleatória → BRX não aceita PixKey
            : { KeyType: keyTypeApi, PixKey: (input.pixKey ?? "").trim() };

        try {
            const resp = await firstValueFrom(
                this.http.post<BrxCreateKeyRaw>(url, body, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }),
            );
            return resp.data;
        } catch (err) {
            const ax = err as AxiosError<{ message?: string }>;
            const msg = ax.response?.data?.message ?? ax.message ?? "Erro ao criar chave na BRX";
            throw new HttpException(msg, ax.response?.status ?? 502);
        }
    }

    async precheckKey(
        accountHolderId: string,
        pixKey: string,
        value?: string,
    ): Promise<PrecheckKeyResponseDto> {
        const token = await this.brxAuth.getAccessToken();
        const qp = value ? `?value=${encodeURIComponent(value)}` : "";
        const url = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}/key/${encodeURIComponent(pixKey)}${qp}`;

        try {
            const resp = await firstValueFrom(
                this.http.get<BrxPrecheckRaw>(url, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            const raw = resp.data;
            const d = raw?.Extensions?.Data;
            if (!d) throw new HttpException("Resposta inesperada da BRX", 502);

            return {
                name: d.Name,
                taxNumber: d.TaxNumber,
                key: d.Key,
                keyType: d.KeyType,
                keyTypeId: Number(d.KeyTypeId),
                bankData: d.BankData
                    ? {
                        ispb: d.BankData.Ispb,
                        name: d.BankData.Name,
                        bankCode: d.BankData.BankCode ?? null,
                        branch: d.BankData.Branch,
                        account: d.BankData.Account,
                        accountType: d.BankData.AccountType,
                        accountTypeId: Number(d.BankData.AccountTypeId),
                    }
                    : undefined,
                endToEnd: d.EndToEnd,
                message: raw?.Extensions?.Message,
            };
        } catch (err) {
            const ax = err as AxiosError<{ message?: string }>;
            const msg = ax.response?.data?.message ?? ax.message ?? "Erro na pré-consulta BRX";
            throw new HttpException(msg, ax.response?.status ?? 502);
        }
    }

    async deleteKey(
        accountHolderId: string,
        pixKey: string,
    ): Promise<{ ok: true; message?: string }> {
        const token = await this.brxAuth.getAccessToken();

        // ✅ URL conforme documentação oficial
        const url = `${this.baseUrl}/pix/account-holders/${encodeURIComponent(accountHolderId)}/keys/${encodeURIComponent(pixKey)}`;

        console.log('🟠 [BRX DELETE] URL chamada →', url);

        try {
            const resp = await firstValueFrom(
                this.http.delete<{ StatusCode?: number; Extensions?: { Message?: string } }>(url, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            console.log('🟢 [BRX DELETE] Resposta:', resp.data);

            return { ok: true, message: resp.data?.Extensions?.Message ?? "Chave Pix removida com sucesso" };
        } catch (err) {
            const ax = err as AxiosError<{ message?: string }>;
            console.error('🔴 [BRX DELETE] Erro:', ax.response?.data || ax.message);
            const msg = ax.response?.data?.message ?? ax.message ?? 'Erro ao remover chave BRX';
            throw new HttpException(msg, ax.response?.status ?? 502);
        }
    }


}
