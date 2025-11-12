// src/inter/controllers/inter-webhook.controller.ts

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterWebhookService } from '../services/inter-webhook.service';
import { WebhookPayloadDto } from '../dto/webhook-payload.dto';

@ApiTags('Inter - Webhooks')
@Controller('inter/webhooks')
export class InterWebhookController {
    constructor(private readonly service: InterWebhookService) { }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar webhooks cadastrados (Admin)' })
    async getWebhooks() {
        return this.service.getWebhooks();
    }

    @Post('pix')
    @ApiOperation({
        summary: 'Receber notificação de Pix (chamado pelo Banco Inter)',
        description: 'Endpoint público para webhook do Inter'
    })
    async handlePixWebhook(@Body() payload: WebhookPayloadDto) {
        await this.service.handlePixReceived(payload);
        return { success: true };
    }
}