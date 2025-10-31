// src/brx-pix/brx-pix.service.ts
import { HttpService } from "@nestjs/axios";
import { Injectable, BadRequestException, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";
import { CreateBrxPixKeyDto } from "./dto/create-brx-pix-key.dto";

function mapKeyTypeToApi(keyType: string): "1" | "2" | "3" | "4" | "5" {
    const t = keyType.toLowerCase();
    if (["1", "cpf"].includes(t)) return "1";
    if (["2", "cnpj"].includes(t)) return "2";
    if (["3", "phone"].includes(t)) return "3";
    if (["4", "email"].includes(t)) return "4";
    if (["5", "random"].includes(t)) return "5"; // ✅ corrigido
    throw new BadRequestException("KeyType inválido");
}


@Injectable()
export class BrxPixService {
    private readonly baseUrl: string;
    private readonly defaultToken?: string;

    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService,
    ) {
        this.baseUrl = this.config.get<string>("BRX_BASE_URL", "https://apisbank.brxbank.com.br");
        this.defaultToken = this.config.get<string>("BRX_TOKEN");
    }

    private authHeader(bearer?: string) {
        const token = bearer ?? this.defaultToken;
        if (!token) throw new UnauthorizedException("Token BRX ausente");
        return { Authorization: `Bearer ${token}` };
    }

    /**
     * GET /pix/keys/account-holders/:account-holder-id/key/:pix-key?value=10.00
     * Retorna Extensions.Data do payload da doc.
     */
    async precheckKey(params: {
        accountHolderId: string;
        pixKey: string;
        value?: string; // “10.00”
        bearer?: string; // opcional; se não vier, usa BRX_TOKEN do env
    }) {
        const { accountHolderId, pixKey, value, bearer } = params;
        const url = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}/key/${encodeURIComponent(pixKey)}${value ? `?value=${encodeURIComponent(value)}` : ""}`;

        try {
            const resp = await firstValueFrom(
                this.http.get(url, { headers: this.authHeader(bearer) })
            );
            // A doc mostra o útil em data.Extensions.Data
            return resp.data?.Extensions?.Data ?? resp.data;
        } catch (err) {
            const e = err as AxiosError<any>;
            const msg = e.response?.data?.Extensions?.Message || e.response?.data?.message || e.message;
            const status = e.response?.status ?? 500;
            if (status === 400) throw new BadRequestException(msg || "Requisição inválida");
            if (status === 401) throw new UnauthorizedException("Token inválido/expirado");
            throw new InternalServerErrorException(msg || "Falha na consulta de chave Pix");
        }
    }

    /**
     * POST /pix/keys/account-holders/:account-holder-id
     * Body: { KeyType: string, PixKey?: string }
     * Se KeyType === "5" (random), NÃO enviar PixKey.
     */
    async createKey(params: {
        accountHolderId: string;
        body: CreateBrxPixKeyDto;
        bearer?: string;
    }) {
        const { accountHolderId, body, bearer } = params;

        const KeyType = mapKeyTypeToApi(body.KeyType);
        const payload: Record<string, string> = { KeyType };

        // Se aleatória, não manda PixKey
        if (KeyType !== "5") {
            if (!body.PixKey) throw new BadRequestException("PixKey é obrigatório para KeyType diferente de random");
            payload.PixKey = body.PixKey;
        }

        const url = `${this.baseUrl}/pix/keys/account-holders/${encodeURIComponent(accountHolderId)}`;

        try {
            const resp = await firstValueFrom(
                this.http.post(url, payload, { headers: this.authHeader(bearer) })
            );
            // a doc não especifica o shape final do POST sucesso,
            // então retornamos o corpo todo (útil para logs)
            return resp.data;
        } catch (err) {
            const e = err as AxiosError<any>;
            const msg = e.response?.data?.Extensions?.Message || e.response?.data?.message || e.message;
            const status = e.response?.status ?? 500;
            if (status === 400) throw new BadRequestException(msg || "Requisição inválida");
            if (status === 401) throw new UnauthorizedException("Token inválido/expirado");
            throw new InternalServerErrorException(msg || "Falha ao cadastrar chave Pix");
        }
    }
}
