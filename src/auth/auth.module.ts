// src/auth/auth.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { MailModule } from "../mail/mail.module";

// Se existir UserModule e AuthService use UserService, pode haver dependência circular.
// Use forwardRef se precisar:
// import { UserModule } from "@/user/user.module";

@Module({
    imports: [
        MailModule,
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({
            secret: process.env.JWT_SECRET!,
            signOptions: { expiresIn: "8h" },
        }),
        // forwardRef(() => UserModule),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        PrismaService,  // necessário se o service usa Prisma
        JwtStrategy,
        JwtAuthGuard,
    ],
    exports: [
        AuthService,    // exporte se outro módulo precisar do AuthService
        JwtModule,      // opcional
    ],
})
export class AuthModule { }
