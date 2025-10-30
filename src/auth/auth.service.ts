import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from "crypto";
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 10;
type JwtPayload = { sub: string; email: string; role: Role };

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwt: JwtService) { }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('invalid_credentials');
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) throw new UnauthorizedException('invalid_credentials');
        return user;
    }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);
        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
        const access_token = await this.jwt.signAsync(payload);
        return { access_token, role: user.role };
    }

    async register(dto: { email: string; password: string; name?: string }) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (exists) throw new BadRequestException('email_in_use');

        const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: { email: dto.email, password: hash, name: dto.name, role: Role.CUSTOMER },
            select: { id: true, email: true, role: true },
        });

        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
        const access_token = await this.jwt.signAsync(payload);
        return { access_token, role: user.role };
    }

    async requestPasswordReset(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        // resposta neutra: não revela existência
        if (!user) return { ok: true };

        // gera token aleatório e guarda hash + expiração (ex: 30 min)
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await this.prisma.passwordResetToken.create({
            data: { userId: user.id, tokenHash, expiresAt },
        });

        const frontendBase = process.env.FRONTEND_BASE_URL ?? "https://otsem-web.vercel.app";
        const resetUrl = `${frontendBase}/reset?token=${token}`;

        // TODO: enviar email de verdade aqui
        // this.mailer.sendPasswordReset(user.email, resetUrl);

        const showUrl = process.env.NODE_ENV !== "production" || process.env.SHOW_RESET_URL === "true";
        return showUrl ? { ok: true, resetUrl } : { ok: true };
    }

    // 2) Consumir token e definir nova senha
    async resetPassword(token: string, password: string) {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const rec = await this.prisma.passwordResetToken.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
            include: { user: true },
        });

        if (!rec) throw new BadRequestException("Token inválido ou expirado");

        const passwordHash = await bcrypt.hash(password, 12);

        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: rec.userId }, data: { password } }),
            this.prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
            // opcional: invalidar tokens antigos desse usuário
            this.prisma.passwordResetToken.updateMany({
                where: { userId: rec.userId, usedAt: null, id: { not: rec.id } },
                data: { usedAt: new Date() },
            }),
        ]);

        return { ok: true };
    }
}
