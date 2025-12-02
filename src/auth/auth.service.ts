import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { MailService } from '../mail/mail.service';

const SALT_ROUNDS = 10;
type JwtPayload = { sub: string; email: string; role: Role };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) { }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('invalid_credentials');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('invalid_credentials');

    // Busca o customer vinculado ao usuário
    const customer = await this.prisma.customer.findUnique({
      where: { email: user.email },
      select: { id: true }
    });

    return {
      ...user,
      customerId: customer?.id,
    };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    // Gera accessToken (curto prazo)
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });

    // Gera refreshToken (longo prazo)
    const refreshPayload = { userId: user.id, email: user.email, type: 'refresh' };
    const refreshToken = await this.jwt.signAsync(refreshPayload, { expiresIn: '7d' });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Busca dados completos do usuário (ajuste conforme seu schema)
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        profileImage: true,
        address: true,
        createdAt: true,
        kycStatus: true,
        has2FA: true,
        hasBiometric: true,
        hasPin: true,
        preferredCurrency: true,
        notificationsEnabled: true,
      },
    });

    return {
      success: true,
      data: {
        user: {
          ...fullUser,
          createdAt: fullUser?.createdAt?.getTime() ?? null,
        },
        accessToken,
        refreshToken,
      },
    };
  }

  async register(dto: { email: string; password: string; name?: string }) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new BadRequestException('email_in_use');

    const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Cria o usuário
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        role: Role.CUSTOMER,
        kycStatus: 'not_started',
        has2FA: false,
        hasBiometric: false,
        hasPin: false,
        preferredCurrency: 'USD',
        notificationsEnabled: true,
      },
      select: { id: true, email: true, role: true },
    });

    // Cria o cliente já vinculado ao usuário
    const customer = await this.prisma.customer.create({
      data: {
        userId: user.id,
        name: dto.name ?? '',
        email: dto.email,
        type: 'PF',
      },
      select: { id: true },
    });

    try {
      await this.prisma.account.create({
        data: {
          customerId: customer.id,
          balance: 0,
          status: 'active',
        },
      });
    } catch (err) {
      console.error('Erro ao criar account:', err);
    }

    // Gera tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync({ userId: user.id, email: user.email, type: 'access' }, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync({ userId: user.id, email: user.email, type: 'refresh' }, { expiresIn: '7d' });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Busca dados completos do usuário
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        profileImage: true,
        address: true,
        createdAt: true,
        kycStatus: true,
        has2FA: true,
        hasBiometric: true,
        hasPin: true,
        preferredCurrency: true,
        notificationsEnabled: true,
      },
    });

    return {
      success: true,
      data: {
        user: {
          ...fullUser,
          createdAt: fullUser?.createdAt?.getTime() ?? null,
        },
        accessToken,
        refreshToken,
      },
    };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // resposta neutra: não revela existência
    if (!user) return { ok: true };

    // gera token aleatório e guarda hash + expiração (ex: 30 min)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendBase =
      process.env.FRONTEND_BASE_URL ?? 'https://otsem-web.vercel.app';
    const resetUrl = `${frontendBase}/reset?token=${token}`;

    await this.mail.sendPasswordReset(user.email, resetUrl);

    const showUrl =
      process.env.NODE_ENV !== 'production' ||
      process.env.SHOW_RESET_URL === 'true';
    return showUrl ? { ok: true, resetUrl } : { ok: true };
  }

  // 2) Consumir token e definir nova senha
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const rec = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true }, // não traz o user inteiro à toa
    });

    if (!rec) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    // gere o hash da nova senha
    const hash = await bcrypt.hash(newPassword, 12);

    // 🔐 ATENÇÃO: troque "passwordHash" pelo campo certo no seu schema (pode ser "password")
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: rec.userId },
        data: { password: hash }, // <--- AQUI estava o bug: antes era { password: newPassword }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      }),
      // opcional: invalida quaisquer outros tokens de reset em aberto
      this.prisma.passwordResetToken.updateMany({
        where: { userId: rec.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      // opcional (ver dicas abaixo): bump de versão de JWT / marca de alteração
      this.prisma.user.update({
        where: { id: rec.userId },
        data: { passwordChangedAt: new Date() }, // crie este campo no User se ainda não tiver
      }),
    ]);

    return { ok: true };
  }
}
