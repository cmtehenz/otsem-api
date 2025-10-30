// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { passwordResetHtml } from './templates/password-reset.html';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resend = new Resend(process.env.RESEND_API_KEY);

    async sendPasswordReset(to: string, resetUrl: string) {
        const productName = process.env.PRODUCT_NAME ?? 'Otsem Bank';
        const html = passwordResetHtml({ resetUrl, productName });

        await this.resend.emails.send({
            from: `Otsem Bank <no-reply@notify.otsembank.com>`, // domínio verificado no Resend
            to,
            subject: 'Redefinição de senha',
            html,
            // opcional: texto puro para melhor entregabilidade
            text: [
                `Redefinição de senha - ${productName}`,
                `Abra o link (válido por 30 minutos):`,
                resetUrl,
                `Se você não solicitou, ignore este e-mail.`,
            ].join('\n'),
        });

        this.logger.log(`E-mail de reset enviado para ${to}`);
    }
}
