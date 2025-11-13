// src/inter/inter.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

// Services
import { InterAuthService } from './services/inter-auth.service';
import { InterWebhookService } from './services/inter-webhook.service';
import { InterPixKeysService } from './services/inter-pix-keys.service';

// Controllers
import { InterWebhookController } from './controllers/inter-webhook.controller';
import { InterPixKeysController } from './controllers/inter-pix-keys.controller';

@Module({
    imports: [ConfigModule, PrismaModule],
    controllers: [
        InterWebhookController,
        InterPixKeysController,
    ],
    providers: [
        InterAuthService,
        InterWebhookService,
        InterPixKeysService,
    ],
    exports: [
        InterAuthService,
        InterWebhookService,
        InterPixKeysService,
    ],
})
export class InterModule { }