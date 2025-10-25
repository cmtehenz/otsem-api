import { Body, Controller, HttpCode, Post, Headers, Req } from '@nestjs/common';
import { CashOutService } from './cashout.service';
import { CreateCashOutDto } from './dto/create-cashout.dto';
import { verifyMtbankSignature } from './mtbank-signature';

@Controller()
export class CashOutController {
    constructor(private readonly svc: CashOutService) { }

    // (Proteja com auth/role ADMIN ou do próprio dono da wallet)
    @Post('cash-out')
    async create(@Body() dto: CreateCashOutDto) {
        const res = await this.svc.requestCashOut(dto);
        return res;
    }

    // webhook de saída do banco
    @Post('webhooks/brx/cash-out')
    @HttpCode(200)
    async webhook(@Body() body: any, @Headers() headers: Record<string, any>, @Req() req: any) {
        const raw = req?.rawBody ?? JSON.stringify(body)
        const ok = verifyMtbankSignature(headers, raw) // reutilizando; se BRX tiver outro header, adaptamos aqui
        if (!ok) return { ok: false, error: 'invalid_signature' }

        const endToEnd = String(body?.EndToEnd ?? body?.endToEnd ?? '')
        const status = String(body?.Status ?? body?.status ?? '')
        if (!endToEnd) return { ok: false, error: 'missing_endtoend' }
        return this.svc.settleByEndToEnd(endToEnd, status, body)
    }
}
