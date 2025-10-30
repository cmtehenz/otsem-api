import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../users/dto/register.dto';
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) { }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        return this.auth.login(body.email, body.password);
    }
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }

    // POST /api/auth/forgot
    @Post("forgot")
    @HttpCode(HttpStatus.OK)
    async forgot(@Body() dto: ForgotPasswordDto) {
        return this.auth.requestPasswordReset(dto.email);
    }

    // POST /api/auth/reset
    @Post("reset")
    @HttpCode(HttpStatus.OK)
    async reset(@Body() dto: ResetPasswordDto) {
        return this.auth.resetPassword(dto.token, dto.password);
    }
}
