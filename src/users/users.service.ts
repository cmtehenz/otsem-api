// src/users/users.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, AccountStatus } from '@prisma/client';
import type { CreateUserWithCustomerDto } from './dto/create-user-with-customer.dto';

const SALT_ROUNDS = 10;

function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  // async createByAdminWithCustomer(dto: CreateUserWithCustomerDto) {
  //   const exists = await this.prisma.user.findUnique({
  //     where: { email: dto.email.toLowerCase() },
  //     select: { id: true },
  //   });
  //   if (exists) {
  //     throw new BadRequestException(
  //       'Este e-mail já está em uso. Por favor, utilize outro endereço.',
  //     );
  //   }

  //   const rawPhone = dto.customer.phone?.trim() ?? '';
  //   const phone = onlyDigits(rawPhone);
  //   if (!phone) {
  //     throw new BadRequestException(
  //       'Telefone é obrigatório para criar o cadastro do cliente.',
  //     );
  //   }

  //   const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

  //   try {
  //     const result = await this.prisma.$transaction(async (tx) => {
  //       const user = await tx.user.create({
  //         data: {
  //           email: dto.email.toLowerCase(),
  //           passwordHash: hash,
  //           name: dto.name?.trim() || null,
  //           role: dto.role ?? Role.CUSTOMER,
  //           isActive: dto.isActive ?? true,
  //         },
  //         select: {
  //           id: true,
  //           email: true,
  //           name: true,
  //           role: true,
  //           isActive: true,
  //           createdAt: true,
  //         },
  //       });

  //       const customer = await tx.customer.create({
  //         data: {
  //           type: dto.customer.type,
  //           accountStatus: AccountStatus.not_requested,
  //           userId: user.id,
  //           externalClientId: null,
  //           externalAccredId: null,
  //           email: user.email,
  //           phone,
  //           name: dto.name ?? '',
  //           cpf: null,
  //           birthday: null,
  //           cnpj: null,
  //         },
  //         select: {
  //           id: true,
  //           type: true,
  //           accountStatus: true,
  //           email: true,
  //           phone: true,
  //           createdAt: true,
  //         },
  //       });

  //       return { user, customer };
  //     });

  //     return { ...result, message: 'Usuário e cliente criados com sucesso.' };
  //   } catch (e) {
  //     if (
  //       e instanceof Prisma.PrismaClientKnownRequestError &&
  //       e.code === 'P2002'
  //     ) {
  //       // unique constraint (email, etc.)
  //       throw new BadRequestException(
  //         'Este e-mail já está em uso. Por favor, utilize outro endereço.',
  //       );
  //     }
  //     throw e;
  //   }
  // }

  // async createByAdmin(dto: {
  //     email: string;
  //     password: string;
  //     name?: string;
  //     role?: Role;
  //     isActive?: boolean;
  //     phone: string;
  //     type: CustomerType;
  // }) {
  //     return this.createByAdminWithCustomer({
  //         email: dto.email,
  //         password: dto.password,
  //         name: dto.name,
  //         role: dto.role,
  //         isActive: dto.isActive,
  //         customer: {
  //             phone: dto.phone,
  //             type: dto.type,
  //             identifier: 'admin',
  //             productId: 1,
  //         },
  //     });
  // }

  async list(take = 50, skip = 0) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          // ajuste o nome do campo conforme seu Prisma: `customers` ou `Customer`
          customers: {
            select: {
              id: true,
              type: true,
              accountStatus: true,
              phone: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return { total, items };
  }

  async updateByAdmin(
    id: string,
    dto: { name?: string; role?: Role; isActive?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user_not_found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, role: dto.role, isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return updated;
  }

  async changePassword(
    requestUser: { userId: string; role: Role },
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (requestUser.role !== Role.ADMIN && requestUser.userId !== id) {
      throw new ForbiddenException('not_allowed');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user_not_found');

    if (requestUser.role !== Role.ADMIN) {
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) throw new BadRequestException('current_password_invalid');
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
    return { ok: true };
  }

  // Use this for any lookup by userId on Customer (userId is not unique yet)
  private async findCustomerByUserId(userId: string) {
    return this.prisma.customer.findFirst({ where: { userId } }); // instead of findUnique({ where: { userId } })
  }

  // Example: get profile merging user + customer
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        // ajuste o nome do campo conforme seu Prisma: `customers` ou `Customer`
        customers: {
          select: {
            id: true,
            type: true,
            accountStatus: true,
            phone: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const customer = await this.findCustomerByUserId(userId);
    return { ...user, customer };
  }

  // Example: update customer via userId (fix for where: { userId } on update)
  async updateCustomerByUserId(userId: string, data: Record<string, any>) {
    const customer = await this.findCustomerByUserId(userId);
    if (!customer) throw new NotFoundException('Customer não encontrado para este usuário');

    return this.prisma.customer.update({
      where: { id: customer.id }, // update by primary key
      data,
    });
  }

  // Example: safe delete customer via userId
  async deleteCustomerByUserId(userId: string) {
    const customer = await this.findCustomerByUserId(userId);
    if (!customer) return { deleted: false };
    await this.prisma.customer.delete({ where: { id: customer.id } });
    return { deleted: true };
  }

  // Exemplo de busca de customer sem 'identifier' (use apenas campos definidos no schema)
  async getCustomerProfile(userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        cnpj: true,
        birthday: true,
        accountStatus: true,
        externalClientId: true,
        externalAccredId: true,
        // Remova 'identifier' se estava aqui!
        // Adicione outros campos válidos conforme seu schema
      },
    });
    if (!customer) throw new NotFoundException('Customer não encontrado');
    return customer;
  }
}
