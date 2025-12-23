import { Controller, Get, Post, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários com paginação e filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'kycStatus', required: false, type: String })
  @ApiQuery({ name: 'accountStatus', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('kycStatus') kycStatus?: string,
    @Query('accountStatus') accountStatus?: string,
  ) {
    return this.service.listUsers({ page, limit, search, kycStatus, accountStatus });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do usuário' })
  @ApiResponse({ status: 200, description: 'Detalhes completos do usuário' })
  async getUserDetails(@Param('id') id: string) {
    return this.service.getUserDetails(id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Transações do usuário' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de transações' })
  async getUserTransactions(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getUserTransactions(id, limit);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Bloquear usuário' })
  @ApiResponse({ status: 200, description: 'Usuário bloqueado' })
  async blockUser(@Param('id') id: string) {
    return this.service.blockUser(id);
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: 'Desbloquear usuário' })
  @ApiResponse({ status: 200, description: 'Usuário desbloqueado' })
  async unblockUser(@Param('id') id: string) {
    return this.service.unblockUser(id);
  }
}
