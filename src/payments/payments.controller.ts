import {
    Controller,
    Get,
    Query,
    Post,
    Body,
    Req,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentListDto } from './dto/payment-list.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { InterPixService } from '../inter/services/inter-pix.service';
import { SendPixDto } from '../inter/dto/send-pix.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

interface User {
    role: 'CUSTOMER' | 'ADMIN';
    customerId?: string;
    // add other properties as needed
}

@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly interPixService: InterPixService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Post('pix/send')
    async sendPix(@Body() dto: SendPixDto, @Req() req: Request) {
        const user = req.user as User;

        let customerId: string;

        if (!user) {
            throw new BadRequestException('Usuário não encontrado na requisição');
        }

        if (user.role === 'CUSTOMER') {
            if (!user.customerId) {
                throw new BadRequestException('customerId não encontrado para o usuário CUSTOMER');
            }
            customerId = user.customerId;
        } else if (user.role === 'ADMIN') {
            if (!dto.customerId) {
                throw new BadRequestException('customerId deve ser informado pelo ADMIN');
            }
            customerId = dto.customerId;
        } else {
            throw new BadRequestException('Usuário não autorizado para enviar Pix');
        }

        return this.interPixService.sendPix(customerId, dto);
    }
}