// src/auth/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

type JwtPayload = { sub: string; email: string; role?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET!,        // defina no .env
            ignoreExpiration: false,
        });
    }

    async validate(payload: JwtPayload) {
        // Opcional, mas recomendado: buscar o usuário atual para dados fresh
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, name: true, role: true },
        });
        // Se não existir mais, pode retornar null e o guard bloqueia
        return user ?? { id: payload.sub, email: payload.email, name: undefined, role: payload.role };
    }
}
