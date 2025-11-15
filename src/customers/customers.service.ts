// src/customers/customers.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, CustomerType } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { CustomerResponse, PaginatedCustomersResponse } from './dto/responses/customer.response';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * 📝 Criar customer (PF ou PJ)
   */
  async create(userId: string, dto: CreateCustomerDto): Promise<CustomerResponse> {
    this.logger.log(`📝 Criando customer tipo ${dto.type} para user ${userId}`);

    await this.validateUniqueness(dto);

    // Ajusta address para formato Prisma
    const addressData = dto.address
      ? { create: { ...dto.address } }
      : undefined;

    try {
      const customer = await this.prisma.customer.create({
        data: {
          userId,
          type: dto.type,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          cpf: dto.cpf,
          cnpj: dto.cnpj,
          birthday: dto.birthday ? new Date(dto.birthday) : undefined,
          rg: dto.rg,
          mothersName: dto.mothersName,
          companyName: dto.companyName,
          tradingName: dto.tradingName,
          foundingDate: dto.foundingDate ? new Date(dto.foundingDate) : undefined,
          address: addressData, // <-- agora compatível!
          metadata: dto.metadata as any,
          accountStatus: 'not_requested',
        },
      });

      // Cria a conta vinculada ao cliente
      await this.prisma.account.create({
        data: {
          customerId: customer.id,
          balance: 0,
          pixKey: null,
          pixKeyType: 'RANDOM',
          dailyLimit: 5000,
          monthlyLimit: 20000,
          status: 'active',
          blockedAmount: 0,
          // createdAt e updatedAt são automáticos
        },
      });

      this.logger.log(`✅ Customer criado: ${customer.id}`);
      return this.toResponse(customer);
    } catch (error: any) {
      this.logger.error('❌ Erro ao criar customer:', error.message);
      throw error;
    }
  }

  /**
   * 🔍 Buscar por ID
   */
  async findById(id: string): Promise<CustomerResponse> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} não encontrado`);
    }

    return this.toResponse(customer);
  }

  /**
   * 🔍 Buscar por userId
   */
  async findByUserId(userId: string): Promise<CustomerResponse> {
    const customer = await this.prisma.customer.findFirst({ where: { userId } }); // <- trocado de findUnique
    if (!customer) {
      throw new NotFoundException('Customer não encontrado para este usuário');
    }
    return this.toResponse(customer);
  }

  /**
   * 📋 Listar com filtros e paginação
   */
  async findAll(query: QueryCustomersDto): Promise<PaginatedCustomersResponse> {
    const { page = 1, limit = 20, search, type, status, cpf, cnpj, email } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { cnpj: { contains: search } },
      ];
    }

    if (type) where.type = type;
    if (status) where.accountStatus = status;
    if (cpf) where.cpf = cpf;
    if (cnpj) where.cnpj = cnpj;
    if (email) where.email = { contains: email, mode: 'insensitive' };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map(this.toResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * ✏️ Atualizar customer
   */
  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerResponse> {
    await this.findById(id); // garante que existe

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        rg: dto.rg,
        mothersName: dto.mothersName,
        companyName: dto.companyName,
        tradingName: dto.tradingName,
        foundingDate: dto.foundingDate ? new Date(dto.foundingDate) : undefined,
        address: dto.address as any,
        accountStatus: dto.accountStatus,
        metadata: dto.metadata as any,
      },
    });

    this.logger.log(`✅ Customer ${id} atualizado`);
    return this.toResponse(customer);
  }

  /**
   * 🗑️ Deletar customer
   */
  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.customer.delete({ where: { id } });
    this.logger.log(`🗑️ Customer ${id} deletado`);
  }

  /**
   * 🔒 Validar unicidade (CPF, CNPJ, Email)
   */
  private async validateUniqueness(dto: CreateCustomerDto): Promise<void> {
    const where: any[] = [{ email: dto.email }];

    if (dto.cpf) where.push({ cpf: dto.cpf });
    if (dto.cnpj) where.push({ cnpj: dto.cnpj });

    const existing = await this.prisma.customer.findFirst({
      where: { OR: where },
    });

    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictException('Email já cadastrado');
      }
      if (existing.cpf === dto.cpf) {
        throw new ConflictException('CPF já cadastrado');
      }
      if (existing.cnpj === dto.cnpj) {
        throw new ConflictException('CNPJ já cadastrado');
      }
    }
  }

  /**
   * 🔄 Converter para Response DTO
   */
  private toResponse = (customer: any): CustomerResponse => {
    return {
      id: customer.id,
      type: customer.type,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpf: customer.cpf,
      cnpj: customer.cnpj,
      accountStatus: customer.accountStatus,
      externalClientId: customer.externalClientId,
      externalAccredId: customer.externalAccredId,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      birthday: customer.birthday,
      statusLabel: this.mapStatus(customer.accountStatus),
    };
  }

  private mapStatus(status: string) {
    const dict: Record<string, string> = {
      not_requested: 'Não solicitado',
      requested: 'Solicitado',
      in_review: 'Em revisão',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
      suspended: 'Suspenso',
    };
    return dict[status] || status;
  }
}
