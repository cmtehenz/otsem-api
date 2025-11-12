// src/inter/inter.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';

// Services
import { InterAuthService } from './services/inter-auth.service';
import { InterBankingService } from './services/inter-banking.service';
import { InterPixService } from './services/inter-pix.service';
import { InterPixKeysService } from './services/inter-pix-keys.service';
import { InterWebhookService } from './services/inter-webhook.service';

// Controllers
import { InterBankingController } from './controllers/inter-banking.controller';
import { InterPixController } from './controllers/inter-pix.controller';
import { InterPixKeysController } from './controllers/inter-pix-keys.controller';
import { InterWebhookController } from './controllers/inter-webhook.controller';
import { InterTestController } from './controllers/inter-test.controller'; // ← Adicionar

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        forwardRef(() => TransactionsModule),
    ],
    controllers: [
        InterBankingController,
        InterPixController,
        InterPixKeysController,
        InterWebhookController,
        InterTestController, // ← Adicionar
    ],
    providers: [
        InterAuthService,
        InterBankingService,
        InterPixService,
        InterPixKeysService,
        InterWebhookService,
    ],
    exports: [
        InterAuthService,
        InterBankingService,
        InterPixService,
        InterPixKeysService,
        InterWebhookService,
    ],
})
export class InterModule { }