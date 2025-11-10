// src/admin-customers/admin-customers.controller.ts
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AdminCustomersService } from './admin-customers.service';
import { AdminListCustomersDto } from './dto/admin-list-customers.dto';
import { AdminUpdateCustomerDto } from './dto/admin-update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AccountStatus } from '@prisma/client';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCustomersController {
    constructor(private readonly service: AdminCustomersService) { }

    // Listar todos os customers com filtros avançados
    @Get()
    async list(@Query() query: AdminListCustomersDto) {
        return this.service.list(query);
    }

    // Estatísticas gerais
    @Get('stats')
    async getStats() {
        return this.service.getStats();
    }

    // Detalhes completos de um customer
    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.service.findById(id);
    }

    // Atualizar customer (dados gerais, endereço, limites)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: AdminUpdateCustomerDto) {
        return this.service.update(id, dto);
    }

    // Atualizar apenas o status da conta
    @Patch(':id/status/:status')
    async updateStatus(
        @Param('id') id: string,
        @Param('status') status: AccountStatus,
    ) {
        return this.service.updateAccountStatus(id, status);
    }

    // Deletar customer
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.service.delete(id);
    }
}
