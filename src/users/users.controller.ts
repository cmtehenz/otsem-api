import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Role, CustomerType } from '@prisma/client';
import type { Request } from 'express'; // 👈 importante: import type
import { PublicRegisterDto } from './dto/public-register.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) { }

  // @Post('register') // pública
  // async register(@Body() dto: PublicRegisterDto) {
  //   const result = await this.svc.createByAdminWithCustomer({
  //     email: dto.email,
  //     password: dto.password,
  //     name: dto.name,
  //     customer: {
  //       type: CustomerType.PF,
  //       name: dto.name,
  //       phone: '00000000000',
  //       productId: 1,
  //     } as any,
  //   });
  //   return {
  //     message: 'Conta criada com sucesso!',
  //     user: result.user,
  //     customer: result.customer,
  //   };
  // }

  @Get()
  async list(@Query('take') take = '50', @Query('skip') skip = '0') {
    const t = Math.min(Number(take || 50), 200);
    const s = Math.max(Number(skip || 0), 0);
    const { total, items } = await this.svc.list(t, s);
    return { ok: true, total, count: items.length, data: items };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updated = await this.svc.updateByAdmin(id, dto);
    return { ok: true, data: updated };
  }

  @Patch(':id/password')
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string; role: Role };
    return this.svc.changePassword(
      user,
      id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
