// src/inter/dto/webhook-payload.dto.ts

import { IsObject } from 'class-validator';

export class WebhookPayloadDto {
    @IsObject()
    pix: any[];
}