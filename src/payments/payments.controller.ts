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

@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly interPixService: InterPixService,
    ) { }

    @Get()
    async listPayments(@Query() query: PaymentListDto): Promise<PaymentResponseDto[]> {
        return this.paymentsService.listPayments(query);
    }

    @UseGuards(JwtAuthGuard)
    @Post('pix/send')
    async sendPix(@Body() dto: SendPixDto, @Req() req) {
        const user = req.user;

        let customerId: string;

        if (user.role === 'CUSTOMER') {
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