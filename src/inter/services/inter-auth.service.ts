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

    // ✅ Caminho atualizado para /src/inter-keys
    private readonly CERT_PATH = path.join(
        process.cwd(),
        'src/inter-keys/certificado.crt'
    );
    private readonly KEY_PATH = path.join(
        process.cwd(),
        'src/inter-keys/chave_privada.key'
    );

    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private httpsAgent: https.Agent;
    private axiosInstance: AxiosInstance;

    constructor() {
        this.initializeHttpsAgent();
        this.initializeAxiosInstance();
    }

    private initializeHttpsAgent() {
        try {
            // ✅ Verificar se certificados existem
            if (!fs.existsSync(this.CERT_PATH)) {
                throw new Error(`❌ Certificado não encontrado: ${this.CERT_PATH}`);
            }

            if (!fs.existsSync(this.KEY_PATH)) {
                throw new Error(`❌ Chave privada não encontrada: ${this.KEY_PATH}`);
            }

            this.httpsAgent = new https.Agent({
                cert: fs.readFileSync(this.CERT_PATH),
                key: fs.readFileSync(this.KEY_PATH),
                rejectUnauthorized: true,
            });

            this.logger.log('✅ Certificados carregados com sucesso');
            this.logger.debug(`📄 Certificado: ${this.CERT_PATH}`);
            this.logger.debug(`🔑 Chave: ${this.KEY_PATH}`);
        } catch (error) {
            this.logger.error('❌ Erro ao carregar certificados:', error.message);
            throw new Error('Certificados do Banco Inter não encontrados');
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