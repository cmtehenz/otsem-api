// src/modules/customers/customers.controller.ts
import {
    Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
    UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto, AccountStatusDto, CustomerTypeDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';

interface AuthRequest extends Request {
    user?: {
        sub: string;
        email: string;
        role?: Role;
    };
}

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
    constructor(private readonly service: CustomersService) { }

    // Lista customers (apenas ADMIN pode filtrar todos; CUSTOMER vê apenas o seu)
    @Get()
    async list(@Req() req: AuthRequest, @Query() query: ListCustomersDto) {
        const userRole = req.user?.role;
        const userId = req.user?.sub!;

        if (userRole === Role.ADMIN) {
            // Admin pode listar todos
            return this.service.list(query);
        }

        // Customer vê apenas o próprio
        const customer = await this.service.findByUserId(userId);
        return customer ? [customer] : [];
    }

    // Retorna dados do próprio customer (ADMIN ou CUSTOMER)
    @Get('me')
    async getMyCustomer(@Req() req: AuthRequest) {
        const userId = req.user?.sub;
        const userRole = req.user?.role;

        if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

        if (userRole === Role.ADMIN) {
            // Admin pode ver todos os customers que ele gerencia
            // Ou retornar informações do próprio admin (se houver customer vinculado)
            const customer = await this.service.findByUserId(userId);
            return customer ?? { message: 'Admin não possui customer vinculado' };
        }

        // Customer retorna seus próprios dados
        const customer = await this.service.findByUserId(userId);
        if (!customer) {
            throw new ForbiddenException('Você ainda não possui um cadastro de cliente.');
        }
        return customer;
    }

    // Cadastro próprio (self-service) - apenas CUSTOMER
    @Post('pf/self')
    @Roles(Role.CUSTOMER)
    async createPfSelf(@Req() req: AuthRequest, @Body() dto: CreatePersonDto) {
        const userId = req.user?.sub;
        if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

        const existing = await this.service.findByUserId(userId);

        if (existing) {
            return this.service.update(existing.id, {
                type: CustomerTypeDto.PF,
                accountStatus: AccountStatusDto.requested,
                email: dto.person.email,
                phone: dto.person.phone,
                name: dto.person.name,
                socialName: dto.person.socialName,
                cpf: dto.person.cpf,
                birthday: dto.person.birthday,
                genderId: dto.person.genderId,
                address: dto.person.address,
                pixLimits: dto.pixLimits,
            });
        }

        return this.service.createPF(dto, userId, AccountStatusDto.requested);
    }

    // Buscar customer por ID (Admin acessa qualquer; Customer apenas o próprio)
    @Get(':id')
    async get(@Req() req: AuthRequest, @Param('id') id: string) {
        const userId = req.user?.sub!;
        const userRole = req.user?.role;

        const customer = await this.service.findById(id);
        if (!customer) return null;

        // Apenas admin ou dono do customer pode acessar
        if (userRole !== Role.ADMIN && customer.userId !== userId) {
            throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
        }

        return customer;
    }

    // Buscar por CPF/CNPJ (apenas ADMIN)
    @Get('by-tax/:tax')
    @Roles(Role.ADMIN)
    async getByTax(@Param('tax') tax: string) {
        const id = await this.service.resolveCustomerId(tax);
        if (!id) return null;
        return this.service.findById(id);
    }

    // Criar PF via admin (apenas ADMIN)
    @Post('pf')
    @Roles(Role.ADMIN)
    async createPF(@Body() dto: CreatePersonDto) {
        return this.service.createPF(dto);
    }

    // Criar PJ via admin (apenas ADMIN)
    @Post('pj')
    @Roles(Role.ADMIN)
    async createPJ(@Body() dto: CreateCompanyDto) {
        return this.service.createPJ(dto);
    }

    // Submeter KYC (CUSTOMER envia para análise)
    @Post('submit-kyc')
    @Roles(Role.CUSTOMER)
    async submitKyc(@Req() req: AuthRequest) {
        const userId = req.user?.sub!;
        return this.service.submitKycByUser(userId);
    }

    // Atualizar customer (Admin atualiza qualquer; Customer apenas o próprio)
    @Patch(':id')
    async update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        const userId = req.user?.sub!;
        const userRole = req.user?.role;

        const customer = await this.service.findById(id);
        if (!customer) throw new ForbiddenException('Customer não encontrado.');

        // Apenas admin ou dono pode atualizar
        if (userRole !== Role.ADMIN && customer.userId !== userId) {
            throw new ForbiddenException('Você não tem permissão para atualizar este recurso.');
        }

        return this.service.update(id, dto);
    }

    // Deletar customer (apenas ADMIN)
    @Delete(':id')
    @Roles(Role.ADMIN)
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}
