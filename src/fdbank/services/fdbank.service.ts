import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FdbankService {
    constructor(private readonly config: ConfigService) { }

    getCredentials() {
        return {
            apiKey: this.config.get<string>('fdbank.apiKey'),
            apiSecret: this.config.get<string>('fdbank.apiSecret'),
            clientId: this.config.get<string>('fdbank.clientId'),
        };
    }

    // Métodos de integração FD Bank serão implementados aqui
}