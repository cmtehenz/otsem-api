import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDashboardController {
    constructor(private readonly service: AdminDashboardService) { }

    @Get('summary')
    async summary() {
        return this.service.getSummary();
    }

    @Get('latest-users')
    async latestUsers() {
        return this.service.getLatestUsers();
    }

    @Get('latest-transactions')
    async latestTransactions() {
        return this.service.getLatestTransactions();
    }
}