// src/customers/customers.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CustomerBalanceService } from './customer-balance.service';
import { CustomerKycService } from './customer-kyc.service';
import { StatementsService } from '../statements/statements.service';
import { CreateCustomerLocalDto } from './dto/create-customer-local.dto';
import { UpdateCustomerLocalDto } from './dto/update-customer-local.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { StatementQueryDto } from '../statements/dto/statement-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
// Tipos apenas de tipo -> import type
import type { AuthRequest } from '../auth/jwt-payload.type';
import type { Request } from 'express';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly balances: CustomerBalanceService,
    private readonly kyc: CustomerKycService,
    private readonly statements: StatementsService,
  ) { }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar customers' })
  async list(@Query() query: QueryCustomersDto) {
    return this.customers.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Ver meu customer' })
  async me(@Req() req: AuthRequest) {
    return this.customers.findByUserId(req.user!.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar meu customer' })
  async updateMe(@Req() req: AuthRequest, @Body() dto: UpdateCustomerLocalDto) {
    const customer = await this.customers.findByUserId(req.user!.sub);
    return this.customers.update(customer.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Criar customer' })
  async create(@Req() req: AuthRequest, @Body() dto: CreateCustomerLocalDto) {
    return this.customers.create(req.user!.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver customer por ID' })
  async get(@Req() req: AuthRequest, @Param('id') id: string) {
    const data = await this.customers.findById(id);
    if (req.user!.role !== Role.ADMIN && req.user!.sub !== (data as any).userId) {
      throw new ForbiddenException('Acesso negado');
    }
    return data;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar customer' })
  async update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateCustomerLocalDto) {
    const current = await this.customers.findById(id);
    if (req.user!.role !== Role.ADMIN && req.user!.sub !== (current as any).userId) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.customers.update(id, dto);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Saldo Pix do customer (soma dos depósitos Pix)' })
  async balance(@Param('id') id: string) {
    return this.balances.getPixBalanceByCustomerId(id);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Extrato do customer' })
  async statement(@Req() req: AuthRequest, @Param('id') id: string, @Query() query: StatementQueryDto) {
    const customer = await this.customers.findById(id);
    if (req.user!.role !== Role.ADMIN && req.user!.sub !== (customer as any).userId) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.statements.getCustomerStatement(id, query);
  }

  // KYC flows
  @Post(':id/kyc/request')
  @ApiOperation({ summary: 'Solicitar KYC - retorna URL de verificação Didit' })
  async requestKyc(@Req() req: AuthRequest, @Param('id') id: string) {
    const customer = await this.customers.findById(id);
    if (req.user!.role !== Role.ADMIN && req.user!.sub !== (customer as any).userId) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.kyc.requestKyc(id);
  }

  @Get(':id/kyc/status')
  @ApiOperation({ summary: 'Consultar status do KYC e decisão Didit' })
  async kycStatus(@Req() req: AuthRequest, @Param('id') id: string) {
    const customer = await this.customers.findById(id);
    if (req.user!.role !== Role.ADMIN && req.user!.sub !== (customer as any).userId) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.kyc.getKycStatus(id);
  }

  @Patch(':id/kyc/review')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mover KYC para revisão' })
  async review(@Param('id') id: string) {
    return this.kyc.moveToReview(id);
  }

  @Patch(':id/kyc/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Aprovar KYC' })
  async approve(@Param('id') id: string) {
    return this.kyc.approve(id);
  }

  @Patch(':id/kyc/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Rejeitar KYC' })
  async reject(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.kyc.reject(id, reason);
  }
}
