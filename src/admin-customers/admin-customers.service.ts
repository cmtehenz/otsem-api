// src/admin-customers/admin-customers.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListCustomersDto } from './dto/admin-list-customers.dto';
import { AdminUpdateCustomerDto } from './dto/admin-update-customer.dto';
import { AccountStatus, Prisma } from '@prisma/client';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminListCustomersDto) {
    const { page = 1, limit = 20, type, accountStatus, search, userId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (type) where.type = type;
    if (accountStatus) where.accountStatus = accountStatus;
    if (userId) where.userId = userId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search.replace(/\D/g, '') } },
        { cnpj: { contains: search.replace(/\D/g, '') } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          accountStatus: true,
          email: true,
          phone: true,
          name: true,
          cpf: true,
          legalName: true,
          cnpj: true,
          externalClientId: true,
          externalAccredId: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          authUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        address: true,
        pixLimits: true,
        ownerships: true,
        authUser: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer com ID ${id} não encontrado.`);
    }

    return customer;
  }

  async update(id: string, dto: AdminUpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer com ID ${id} não encontrado.`);
    }

    const { address, pixLimits, ...customerData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Atualizar customer
      const updated = await tx.customer.update({
        where: { id },
        data: customerData,
      });

      // Atualizar endereço se fornecido
      if (address) {
        await tx.address.upsert({
          where: { customerId: id },
          update: address,
          create: { ...address, customerId: id },
        });
      }

      // Atualizar limites PIX se fornecido
      if (pixLimits) {
        await tx.pixLimits.upsert({
          where: { customerId: id },
          update: pixLimits,
          create: { ...pixLimits, customerId: id },
        });
      }

      return this.findById(id);
    });
  }

  async updateAccountStatus(id: string, status: AccountStatus) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer com ID ${id} não encontrado.`);
    }

    return this.prisma.customer.update({
      where: { id },
      data: { accountStatus: status },
      select: {
        id: true,
        type: true,
        accountStatus: true,
        email: true,
        name: true,
        legalName: true,
      },
    });
  }

  async delete(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer com ID ${id} não encontrado.`);
    }

    await this.prisma.customer.delete({ where: { id } });
    return { message: 'Customer deletado com sucesso.' };
  }

  async getStats() {
    const [total, byType, byStatus] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.groupBy({
        by: ['type'],
        _count: true,
      }),
      this.prisma.customer.groupBy({
        by: ['accountStatus'],
        _count: true,
      }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.accountStatus] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
