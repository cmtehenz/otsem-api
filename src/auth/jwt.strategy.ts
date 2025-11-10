// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "./roles.enum";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || "default-secret-change-me",
        });
    }

    async validate(payload: any) {
        if (!payload.sub || !payload.email) {
            throw new UnauthorizedException("Token inválido");
        }

        return {
            sub: payload.sub,
            email: payload.email,
            role: payload.role as Role, // ← certifique-se de fazer cast para enum
        };
    }
}
