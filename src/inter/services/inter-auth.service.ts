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

    // Produção: https://cdpj.partners.bancointer.com.br | Sandbox: https://cdpj-sandbox.partners.uatinter.co
    private readonly INTER_API_URL = 'https://cdpj.partners.bancointer.com.br';

    private readonly CLIENT_ID = process.env.INTER_CLIENT_ID;
    private readonly CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;

    private CERT_PATH: string;
    private KEY_PATH: string;

    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private httpsAgent: https.Agent | null = null;
    private axiosInstance: AxiosInstance | null = null;
    private isConfigured = false;

    constructor() {
        try {
            this.resolveCertPaths();
            this.initializeHttpsAgent();
            this.initializeAxiosInstance();
            this.isConfigured = true;
        } catch (error) {
            this.logger.warn('Inter API not configured - certificates not found. Inter banking features disabled.');
        }
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
            this.logger.log(`✅ Certificados (ENV): ${path.dirname(envCert)}`);
            return;
        }

        // 1) Produção (mesmo nível de dist) → /var/www/otsem-api/inter-keys
        const possible = [
            { cert: path.join(process.cwd(), 'inter-keys/certificado.crt'), key: path.join(process.cwd(), 'inter-keys/chave_privada.key') },
            { cert: path.join(process.cwd(), 'dist/src/inter-keys/certificado.crt'), key: path.join(process.cwd(), 'dist/src/inter-keys/chave_privada.key') },
            { cert: path.join(process.cwd(), 'dist/inter-keys/certificado.crt'), key: path.join(process.cwd(), 'dist/inter-keys/chave_privada.key') },
            { cert: path.join(process.cwd(), 'src/inter-keys/certificado.crt'), key: path.join(process.cwd(), 'src/inter-keys/chave_privada.key') },
            { cert: path.join(__dirname, '../../inter-keys/certificado.crt'), key: path.join(__dirname, '../../inter-keys/chave_privada.key') },
        ];

        for (const p of possible) {
            if (fs.existsSync(p.cert) && fs.existsSync(p.key)) {
                this.CERT_PATH = p.cert;
                this.KEY_PATH = p.key;
                this.logger.log(`✅ Certificados: ${path.dirname(p.cert)}`);
                return;
            }
        }

        this.logger.error('❌ Certificados não encontrados.');
        throw new Error('Certificados do Banco Inter não encontrados');
    }

    private initializeHttpsAgent() {
        try {
            // PFX opcional
            const pfxPath = process.env.INTER_CERT_PFX_PATH;
            const pfxPass = process.env.INTER_CERT_PFX_PASS;
            if (pfxPath && fs.existsSync(pfxPath)) {
                this.logger.log(`✅ Usando PFX: ${pfxPath}`);
                this.httpsAgent = new https.Agent({
                    pfx: fs.readFileSync(pfxPath),
                    passphrase: pfxPass || '',
                    rejectUnauthorized: true,
                });
                return;
            }

            let certContent = fs.readFileSync(this.CERT_PATH, 'utf8');
            const keyContent = fs.readFileSync(this.KEY_PATH, 'utf8');

            // CA externo opcional
            const caPath = process.env.INTER_CA_PATH;
            let ca: string[] | undefined;
            if (caPath && fs.existsSync(caPath)) {
                ca = [fs.readFileSync(caPath, 'utf8')];
                this.logger.log(`🔗 CA externo carregado`);
            } else {
                // Extrair cadeia do próprio .crt (multi-cert)
                const blocks = certContent
                    .split(/-----END CERTIFICATE-----/g)
                    .filter(b => b.includes('BEGIN CERTIFICATE'))
                    .map(b => b + '-----END CERTIFICATE-----')
                    .map(b => b.trim());
                if (blocks.length > 1) {
                    certContent = blocks[0];
                    ca = blocks.slice(1);
                    this.logger.log(`🔗 Cadeia detectada (${ca.length} intermediários)`);
                }
            }

            this.httpsAgent = new https.Agent({
                cert: certContent,
                key: keyContent,
                ca,
                rejectUnauthorized: true,
            });

            this.logger.log('✅ Certificados (PEM) carregados');
        } catch (e: any) {
            this.logger.error('❌ Erro certificados:', e.message);
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
        if (!this.isConfigured) {
            throw new Error('Inter API not configured - certificates not found');
        }
        // Verificar se token ainda é válido (com margem de 5 minutos)
        if (this.accessToken && this.tokenExpiry && new Date() < new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)) {
            return this.accessToken;
        }
        this.logger.log('🔐 Novo token OAuth 2.0');
        try {
            const response = await axios.post<InterTokenResponse>(
                `${this.INTER_API_URL}/oauth/v2/token`,
                new URLSearchParams({
                    client_id: this.CLIENT_ID!,
                    client_secret: this.CLIENT_SECRET!,
                    grant_type: 'client_credentials',
                    scope: 'extrato.read boleto-cobranca.read boleto-cobranca.write cob.read cob.write cobv.read cobv.write pix.read pix.write webhook.read webhook.write pagamento-pix.write',
                }),
                {
                    httpsAgent: this.httpsAgent!,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            );
            this.accessToken = response.data.access_token;
            this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
            this.logger.log('✅ Token obtido');
            return this.accessToken;
        } catch (error: any) {
            this.logger.error('❌ Erro token:', error?.message);
            throw new Error('Falha na autenticação com Banco Inter');
        }
    }

    isServiceConfigured(): boolean {
        return this.isConfigured;
    }

    getAxiosInstance() { 
        if (!this.isConfigured) {
            throw new Error('Inter API not configured - certificates not found');
        }
        return this.axiosInstance!; 
    }
    getHttpsAgent() { 
        if (!this.isConfigured) {
            throw new Error('Inter API not configured - certificates not found');
        }
        return this.httpsAgent!; 
    }
}