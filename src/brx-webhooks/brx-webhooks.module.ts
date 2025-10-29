// src/brx-webhooks/brx-webhooks.module.ts
import { Module } from '@nestjs/common';
import { BrxWebhooksController } from './brx-webhooks.controller';
import { BrxWebhooksService } from './brx-webhooks.service';

@Module({
    controllers: [BrxWebhooksController],
    providers: [BrxWebhooksService],
})
export class BrxWebhooksModule { }
