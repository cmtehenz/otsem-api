import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InterPixService } from '../services/inter-pix.service';

@Injectable()
export class InterPixPollingTask {
    private readonly logger = new Logger(InterPixPollingTask.name);

    constructor(private readonly interPixService: InterPixService) { }

    // Executa a cada 15 minutos
    @Cron('*/1 * * * *')
    async pollPixReceived() {
        this.logger.log('🔄 Consultando Pix recebidos via polling...');
        await this.interPixService.fetchAndProcessPixReceived();
    }
}