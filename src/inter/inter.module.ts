// src/inter/inter.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

// Services
import { InterAuthService } from './services/inter-auth.service';
import { InterWebhookService } from './services/inter-webhook.service';
import { InterPixKeysService } from './services/inter-pix-keys.service';
import { InterBankingService } from './services/inter-banking.service'; // ✅ ADICIONAR
import { InterPixService } from './services/inter-pix.service';

// Controllers
import { InterWebhookController } from './controllers/inter-webhook.controller';
import { InterPixKeysController } from './controllers/inter-pix-keys.controller';
import { InterTestController } from './controllers/inter-test.controller';
import { InterBankingController } from './controllers/inter-banking.controller';
import { InterPixController } from './controllers/inter-pix.controller';
import { InterPixPollingTask } from './tasks/inter-pix-polling.task';
import { InterPixTesteService } from './services/inter-pix-teste.service';

@Module({
    imports: [ConfigModule, PrismaModule],
    controllers: [
        InterWebhookController,
        InterPixKeysController,
        InterTestController,
        InterBankingController,
        InterPixController,
    ],
    providers: [
        InterAuthService,
        InterWebhookService,
        InterPixTesteService,
        InterPixService,
        InterPixKeysService,
        InterBankingService, // ✅ ADICIONAR aqui
        InterPixPollingTask,
    ],
    exports: [
        InterAuthService,
        InterWebhookService,
        InterPixKeysService,
        InterPixService,
        InterBankingService, // ✅ E ADICIONAR aqui
    ],
})
export class InterModule { }