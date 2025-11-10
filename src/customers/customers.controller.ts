// src/modules/customers/customers.controller.ts
import {
    Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto, AccountStatusDto, CustomerTypeDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
    user?: {
        sub: string;         // <<-- use sub (não id)
        email: string;
        role?: string;
    };
}

@Controller('customers')
export class CustomersController {
    constructor(private readonly service: CustomersService) { }

    @Get()
    async list(@Query() query: ListCustomersDto) {
        return this.service.list(query);
    }

    @UseGuards(JwtAuthGuard)
    @Post('pf/self')
    async createPfSelf(@Req() req: AuthRequest, @Body() dto: CreatePersonDto) {
        const userId = req.user?.sub;
        if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

        const existing = await this.service.findByUserId(userId);

        if (existing) {
            // Atualiza dados + marca como requested (cliente submeteu)
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

        // Cria o customer já vinculado ao user e deixa status como requested (o admin depois coloca in_review)
        return this.service.createPF(dto, userId, AccountStatusDto.requested);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMyCustomer(@Req() req: AuthRequest) {
        const userId = req.user?.sub;
        if (!userId) throw new UnauthorizedException('Usuário não autenticado.');
        const customer = await this.service.findByUserId(userId);
        return customer ?? null;
    }

    @Get(':id')
    async get(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Get('by-tax/:tax')
    async getByTax(@Param('tax') tax: string) {
        const id = await this.service.resolveCustomerId(tax);
        if (!id) return null;
        return this.service.findById(id);
    }

    @Post('pf')
    async createPF(@Body() dto: CreatePersonDto) {
        return this.service.createPF(dto);
    }

    @Post('pj')
    async createPJ(@Body() dto: CreateCompanyDto) {
        return this.service.createPJ(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('submit-kyc')
    async submitKyc(@Req() req: AuthRequest) {
        const userId = req.user?.sub!;
        return this.service.submitKycByUser(userId);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}
