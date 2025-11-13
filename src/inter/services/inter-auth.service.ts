// src/inter/services/inter-auth.service.ts

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { InterTokenResponse } from '../types/inter.types';

@Injectable()
export class InterAuthService {
    private readonly logger = new Logger(InterAuthService.name);

    private readonly INTER_API_URL = process.env.INTER_API_URL ||
        'https://cdpj-sandbox.partners.uatinter.co';

    private readonly CLIENT_ID = process.env.INTER_CLIENT_ID;
    private readonly CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;

    private CERT_PATH: string;
    private KEY_PATH: string;

    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private httpsAgent: https.Agent;
    private axiosInstance: AxiosInstance;

    constructor() {
        this.resolveCertPaths();
        this.initializeHttpsAgent();
        this.initializeAxiosInstance();
    }

    /**
     * Resolve caminhos dos certificados (prod e dev)
     */
    private resolveCertPaths() {
        // 0) Variáveis de ambiente (prioridade máxima)
        const envCert = process.env.INTER_CERT_PATH;
        const envKey = process.env.INTER_KEY_PATH;
        if (envCert && envKey && fs.existsSync(envCert) && fs.existsSync(envKey)) {
            this.CERT_PATH = envCert;
            this.KEY_PATH = envKey;
            this.logger.log(`✅ Certificados (ENV) em: ${path.dirname(envCert)}`);
            return;
        }

        // 1) Produção (mesmo nível de dist) → /var/www/otsem-api/inter-keys
        const possiblePaths = [
            {
                cert: path.join(process.cwd(), 'inter-keys/certificado.crt'),
                key: path.join(process.cwd(), 'inter-keys/chave_privada.key'),
            },
            // 2) Produção (copiados no build)
            {
                cert: path.join(process.cwd(), 'dist/src/inter-keys/certificado.crt'),
                key: path.join(process.cwd(), 'dist/src/inter-keys/chave_privada.key'),
            },
            {
                cert: path.join(process.cwd(), 'dist/inter-keys/certificado.crt'),
                key: path.join(process.cwd(), 'dist/inter-keys/chave_privada.key'),
            },
            // 3) Desenvolvimento (src)
            {
                cert: path.join(process.cwd(), 'src/inter-keys/certificado.crt'),
                key: path.join(process.cwd(), 'src/inter-keys/chave_privada.key'),
            },
            // 4) Relativo ao arquivo compilado em dist/
            {
                cert: path.join(__dirname, '../../inter-keys/certificado.crt'),
                key: path.join(__dirname, '../../inter-keys/chave_privada.key'),
            },
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p.cert) && fs.existsSync(p.key)) {
                this.CERT_PATH = p.cert;
                this.KEY_PATH = p.key;
                this.logger.log(`✅ Certificados encontrados em: ${path.dirname(p.cert)}`);
                this.logger.debug(`cwd: ${process.cwd()} | __dirname: ${__dirname}`);
                return;
            }
        }

        this.logger.error('❌ Certificados não encontrados. Tentativas:');
        this.logger.error(`cwd: ${process.cwd()} | __dirname: ${__dirname}`);
        possiblePaths.forEach((p, i) => {
            const certExists = fs.existsSync(p.cert) ? '✓' : '✗';
            const keyExists = fs.existsSync(p.key) ? '✓' : '✗';
            this.logger.error(`  ${i + 1}. ${certExists} Cert: ${p.cert}`);
            this.logger.error(`     ${keyExists} Key:  ${p.key}`);
        });

        throw new Error('Certificados do Banco Inter não encontrados');
    }

    private initializeHttpsAgent() {
        try {
            this.httpsAgent = new https.Agent({
                cert: fs.readFileSync(this.CERT_PATH),
                key: fs.readFileSync(this.KEY_PATH),
                rejectUnauthorized: true,
            });

            this.logger.log('✅ Certificados carregados com sucesso');
        } catch (error) {
            this.logger.error('❌ Erro ao carregar certificados:', error.message);
            throw new Error('Falha ao carregar certificados do Banco Inter');
        }
    }

    private initializeAxiosInstance() {
        this.axiosInstance = axios.create({
            baseURL: this.INTER_API_URL,
            httpsAgent: this.httpsAgent,
            timeout: 30000,
        });

        // Interceptor para adicionar token automaticamente
        this.axiosInstance.interceptors.request.use(
            async (config) => {
                // Não adicionar token na rota de autenticação
                if (config.url?.includes('/oauth/v2/token')) {
                    return config;
                }

                const token = await this.getToken();
                config.headers.Authorization = `Bearer ${token}`;
                return config;
            },
            (error) => Promise.reject(error)
        );
    }

    async getToken(): Promise<string> {
        // Verificar se token ainda é válido (com margem de 5 minutos)
        if (
            this.accessToken &&
            this.tokenExpiry &&
            new Date() < new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)
        ) {
            return this.accessToken;
        }

        this.logger.log('🔐 Obtendo novo token OAuth 2.0...');

        try {
            const response = await axios.post<InterTokenResponse>(
                `${this.INTER_API_URL}/oauth/v2/token`,
                new URLSearchParams({
                    client_id: this.CLIENT_ID!,
                    client_secret: this.CLIENT_SECRET!,
                    grant_type: 'client_credentials',
                    scope: 'extrato.read boleto-cobranca.read boleto-cobranca.write pix.read pix.write webhook.read webhook.write',
                }),
                {
                    httpsAgent: this.httpsAgent,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = new Date(
                Date.now() + response.data.expires_in * 1000
            );

            this.logger.log('✅ Token obtido com sucesso');
            this.logger.debug(
                `⏱️  Token expira em: ${response.data.expires_in} segundos`
            );

            return this.accessToken;
        } catch (error) {
            this.logger.error('❌ Erro ao obter token:', error.response?.data || error.message);
            throw new Error('Falha na autenticação com Banco Inter');
        }
    }

    getAxiosInstance(): AxiosInstance {
        return this.axiosInstance;
    }

    getHttpsAgent(): https.Agent {
        return this.httpsAgent;
    }
}