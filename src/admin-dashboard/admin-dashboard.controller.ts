import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) { }

  @Get('stats')
  @ApiOperation({ summary: '📊 Dashboard completo com todos os dados (Admin)' })
  async stats() {
    return this.service.getStats();
  }

  @Get('summary')
  @ApiOperation({ summary: '📈 Resumo de customers e transações (Admin)' })
  async summary() {
    return this.service.getSummary();
  }

  @Get('inter-balance')
  @ApiOperation({ summary: '💰 Saldos detalhados da conta Inter (Admin)' })
  async interBalance() {
    return this.service.getInterBalance();
  }

  @Get('latest-users')
  @ApiOperation({ summary: '👥 Últimos 10 customers cadastrados (Admin)' })
  async latestUsers() {
    return this.service.getLatestUsers();
  }

  @Get('latest-transactions')
  @ApiOperation({ summary: '💸 Últimas 10 transações (Admin)' })
  async latestTransactions() {
    return this.service.getLatestTransactions();
  }
}
