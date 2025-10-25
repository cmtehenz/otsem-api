import axios, { AxiosInstance } from 'axios'
import qs from 'querystring'
import { Injectable, Logger } from '@nestjs/common'
import { unwrapBrx } from './brx-envelope'

type TokenResp = {
    access_token: string
    token_type: string
    expires_in: number // segundos
    scope?: string
}

@Injectable()
export class BrxClient {
    private readonly logger = new Logger(BrxClient.name)
    private http: AxiosInstance
    private token?: { value: string; exp: number } // epoch seconds

    private TOKEN_URL = process.env.BRX_TOKEN_URL || 'https://token.brxbank.com.br/oauth2/token'
    private API_BASE = process.env.BRX_API_BASE || 'https://apisbank.brxbank.com.br'
    private CLIENT_ID = process.env.BRX_CLIENT_ID!
    private CLIENT_SECRET = process.env.BRX_CLIENT_SECRET!
    private SCOPE = process.env.BRX_SCOPE || 'clients_api/big_pix'
    private TIMEOUT = Number(process.env.BRX_TIMEOUT_MS || 15000)
    private LOG_HTTP = process.env.BRX_LOG_HTTP === '1'

    constructor() {
        this.http = axios.create({
            baseURL: this.API_BASE,
            timeout: this.TIMEOUT,
        })

        // add bearer token automaticamente
        this.http.interceptors.request.use(async (cfg) => {
            const token = await this.getToken()
            cfg.headers = cfg.headers || {}
            cfg.headers.Authorization = `Bearer ${token}`
            if (this.LOG_HTTP) {
                this.logger.debug(`[REQ] ${cfg.method?.toUpperCase()} ${cfg.baseURL}${cfg.url}`)
            }
            return cfg
        })

        this.http.interceptors.response.use(
            (res) => {
                if (this.LOG_HTTP) this.logger.debug(`[RES] ${res.status} ${res.config.url}`)
                return res
            },
            (err) => {
                const code = err?.response?.status
                const data = err?.response?.data
                if (this.LOG_HTTP) this.logger.warn(`[ERR] ${code} ${err?.config?.url} -> ${JSON.stringify(data)}`)
                return Promise.reject(err)
            },
        )
    }

    private async getToken(): Promise<string> {
        const now = Math.floor(Date.now() / 1000)
        if (this.token && this.token.exp - 15 > now) return this.token.value // 15s de margem

        const basic = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64')
        const body = qs.stringify({
            grant_type: 'client_credentials',
            client_id: this.CLIENT_ID, // BRX pode exigir no body também
            scope: this.SCOPE,
        })

        const resp = await axios.post<TokenResp>(this.TOKEN_URL, body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basic}`,
            },
            timeout: this.TIMEOUT,
        })

        const tok = resp.data
        const exp = Math.floor(Date.now() / 1000) + (tok.expires_in || 300)
        this.token = { value: tok.access_token, exp }
        return this.token.value
    }

    /**
     * Cria um PIX de saída.
     * Ajuste `path` e `payload` conforme a rota BRX real de cash-out.
     * O método já lida com o envelope padrão e retorna o Data “limpo”.
     */
    async createPixOut(payload: {
        amount: number
        pixKey: string
        pixKeyType: string // CPF/CNPJ/EMAIL/CELULAR/CHAVE_ALEATORIA
        beneficiaryName: string
        beneficiaryTaxNumber: string
        requestId: string
    }) {
        // Exemplo de path — TROQUE para o caminho correto quando tiver (p.ex. /pix/transactions/cash-out)
        const path = '/pix/cash-out'

        const res = await this.http.post(path, {
            Amount: payload.amount,
            PixKey: payload.pixKey,
            PixKeyType: payload.pixKeyType,
            BeneficiaryName: payload.beneficiaryName,
            BeneficiaryTaxNumber: payload.beneficiaryTaxNumber,
            RequestId: payload.requestId,
        })

        // desenvelopa: { StatusCode, ..., Extensions.Data: {...} }
        const data = unwrapBrx<any>(res.data)

        // Devolvemos algo padronizado para o service
        return {
            endToEnd: data?.EndToEnd ?? data?.endToEnd ?? data?.EndToEndId ?? null,
            status: (data?.Status ?? data?.status ?? 'PROCESSING') as string,
            raw: data,
        }
    }
}
