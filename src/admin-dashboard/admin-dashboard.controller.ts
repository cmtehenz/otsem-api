import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Dashboard completo' })
  @ApiResponse({ status: 200, description: 'OK' })
  async stats() {
    return this.service.getStats();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo geral' })
  @ApiResponse({ status: 200, description: 'OK' })
  async summary() {
    return this.service.getSummary();
  }

  // Remova este endpoint se não tiver InterBankingService no service.
  @Get('inter-balance')
  @ApiOperation({ summary: 'Saldo Inter' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 503, description: 'Serviço não disponível' })
  async interBalance() {
    if (!this.service.getInterBalance) {
      return { available: false, message: 'InterBankingService não ativo' };
    }
    return this.service.getInterBalance();
  }

  @Get('latest-users')
  @ApiOperation({ summary: 'Últimos usuários' })
  @ApiResponse({ status: 200, description: 'OK' })
  async latestUsers() {
    return this.service.getLatestUsers();
  }

  @Get('latest-transactions')
  @ApiOperation({ summary: 'Últimas transações' })
  @ApiResponse({ status: 200, description: 'OK' })
  async latestTransactions() {
    return this.service.getLatestTransactions();
  }
}
