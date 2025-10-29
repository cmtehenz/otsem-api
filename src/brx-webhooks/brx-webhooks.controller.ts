// src/brx-webhooks/brx-webhooks.controller.ts
import {
    Controller, Post, Req, Res, HttpCode, Headers
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { BrxWebhooksService } from './brx-webhooks.service';

@Controller()
export class BrxWebhooksController {
    constructor(private readonly service: BrxWebhooksService) { }

    // Depósitos (cash-in)
    @Post('cash-in')
    @HttpCode(200)
    async cashIn(@Req() req: Request, @Res() res: Response, @Headers() headers: Record<string, string>) {
        try {
            await this.service.handleCashIn(req, headers);
            return res.send({ ok: true });
        } catch (e) {
            console.error('cash-in error', e);
            return res.status(400).send({ ok: false, error: 'bad payload' });
        }
    }

    // Pagamentos (cash-out)
    @Post('cash-out')
    @HttpCode(200)
    async cashOut(@Req() req: Request, @Res() res: Response, @Headers() headers: Record<string, string>) {
        try {
            await this.service.handleCashOut(req, headers);
            return res.send({ ok: true });
        } catch (e) {
            console.error('cash-out error', e);
            return res.status(400).send({ ok: false, error: 'bad payload' });
        }
    }

    // Devoluções (refunds)
    @Post('refunds')
    @HttpCode(200)
    async refunds(@Req() req: Request, @Res() res: Response, @Headers() headers: Record<string, string>) {
        try {
            await this.service.handleRefund(req, headers);
            return res.send({ ok: true });
        } catch (e) {
            console.error('refunds error', e);
            return res.status(400).send({ ok: false, error: 'bad payload' });
        }
    }
}
