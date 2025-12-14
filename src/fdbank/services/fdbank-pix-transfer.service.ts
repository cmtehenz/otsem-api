import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankPixTransferService {
    private readonly logger = new Logger(FdbankPixTransferService.name);
    private baseUrl = 'https://api-baas.fdbank.com.br/v1.0/Pix/Transfer/';
    private token = process.env.FDBANK_API_TOKEN;

    private getHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-api-url': this.token,
        };
    }

    async createPixTransfer(data: any) {
        try {
            const response = await axios.post(this.baseUrl, data, {
                headers: this.getHeaders(),
            });
            return response.data;
        } catch (error: any) {
            this.logger.error('Erro ao criar transferência PIX:', error.response?.data || error.message);
            throw error;
        }
    }

    async generatePixDynamicQrCode(pixKeyId: string, value: number, message?: string, externalId?: string) {
        const MIN_VALUE = 10;
        if (value < MIN_VALUE) {
            throw new Error(`Valor mínimo para QR Code é R$ ${MIN_VALUE},00`);
        }

        const payload = {
            pixKeyId,
            value,
            message: message || '',
            externalId: externalId || '',
        };

        this.logger.log(`Gerando QR Code PIX: pixKeyId=${pixKeyId}, value=${value}`);

        try {
            const response = await axios.post(`${this.baseUrl}GeneratePixDynamicQrCode`, payload, {
                headers: this.getHeaders(),
            });
            this.logger.log('QR Code gerado com sucesso');
            return response.data;
        } catch (error: any) {
            this.logger.error('Erro ao gerar QR Code PIX:', error.response?.data || error.message);
            throw error;
        }
    }

    async captureQrCode(data: any) {
        try {
            const response = await axios.post(`${this.baseUrl}CaptureQrCode`, data, {
                headers: this.getHeaders(),
            });
            return response.data;
        } catch (error: any) {
            this.logger.error('Erro ao capturar QR Code:', error.response?.data || error.message);
            throw error;
        }
    }
}