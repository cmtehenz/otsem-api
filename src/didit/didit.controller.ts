import { Controller, Post, Body, Logger, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { DiditWebhookPayloadDto } from './dto/webhook.dto';
import { AccountStatus } from '@prisma/client';

@ApiTags('Didit Webhooks')
@Controller('kyc/didit')
export class DiditController {
  private readonly logger = new Logger(DiditController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook para receber notificações de verificação Didit' })
  @ApiResponse({ status: 200, description: 'Webhook processado com sucesso' })
  async handleVerificationWebhook(@Body() payload: DiditWebhookPayloadDto) {
    this.logger.log(`Webhook Didit recebido: sessionId=${payload.session_id}, decision=${payload.decision}`);

    await this.prisma.webhookLog.create({
      data: {
        source: 'didit',
        type: 'verification',
        payload: payload as any,
        processed: false,
      },
    });

    if (!payload.session_id) {
      this.logger.warn('Webhook sem session_id, ignorando');
      return { received: true, warning: 'Missing session_id' };
    }

    const customer = await this.prisma.customer.findFirst({
      where: { diditSessionId: payload.session_id },
    });

    if (!customer) {
      this.logger.warn(`Session ID não encontrado no banco: ${payload.session_id}`);
      throw new UnauthorizedException('Session ID não reconhecido');
    }

    let newStatus: AccountStatus | null = null;

    switch (payload.decision?.toLowerCase()) {
      case 'approved':
        newStatus = AccountStatus.approved;
        break;
      case 'declined':
        newStatus = AccountStatus.rejected;
        break;
      case 'review':
        newStatus = AccountStatus.in_review;
        break;
    }

    if (newStatus) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { accountStatus: newStatus },
      });

      this.logger.log(`Customer ${customer.id} atualizado para status ${newStatus}`);
    }

    await this.prisma.webhookLog.updateMany({
      where: {
        source: 'didit',
        payload: { path: ['session_id'], equals: payload.session_id },
        processed: false,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return { received: true, customerId: customer.id, newStatus };
  }
}
