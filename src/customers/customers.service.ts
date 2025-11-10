// src/modules/customers/customers.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto, AccountStatusDto } from './dto/update-customer.dto';

function onlyDigits(v: string): string {
    return (v || '').replace(/\D/g, '');
}

@Injectable()
export class CustomersService {
    constructor(private readonly prisma: PrismaService) { }

    // ✨ createPF agora aceita userId e status inicial (opcionais)
    async createPF(
        input: CreatePersonDto,
        userId?: string,
        initialStatus: AccountStatusDto = AccountStatusDto.not_requested,
    ) {
        const { identifier, productId, person, pixLimits } = input;
        const cpf = onlyDigits(person.cpf);

        return this.prisma.customer.create({
            data: {
                userId: userId ?? null,                    // <<-- vincula ao usuário se vier
                type: 'PF',
                accountStatus: initialStatus,              // <<-- status inicial
                identifier,
                productId,
                email: person.email,
                phone: person.phone,
                name: person.name,
                socialName: person.socialName ?? null,
                cpf,
                birthday: new Date(person.birthday),
                genderId: person.genderId ?? null,
                address: {
                    create: {
                        zipCode: person.address.zipCode,
                        street: person.address.street,
                        number: person.address.number ?? null,
                        complement: person.address.complement ?? null,
                        neighborhood: person.address.neighborhood,
                        cityIbgeCode: person.address.cityIbgeCode,
                    },
                },
                pixLimits: {
                    create: {
                        singleTransfer: pixLimits.singleTransfer,
                        daytime: pixLimits.daytime,
                        nighttime: pixLimits.nighttime,
                        monthly: pixLimits.monthly,
                        serviceId: pixLimits.serviceId,
                    },
                },
            },
            include: { address: true, pixLimits: true, ownerships: true },
        });
    }

    async createPJ(input: CreateCompanyDto) {
        const { identifier, productId, company, pixLimits } = input;
        const cnpj = onlyDigits(company.cnpj);

        return this.prisma.customer.create({
            data: {
                type: 'PJ',
                accountStatus: 'not_requested',
                identifier,
                productId,
                email: company.email,
                phone: company.phone,
                legalName: company.legalName,
                tradeName: company.tradeName,
                cnpj,
                address: {
                    create: {
                        zipCode: company.address.zipCode,
                        street: company.address.street,
                        number: company.address.number ?? null,
                        complement: company.address.complement ?? null,
                        neighborhood: company.address.neighborhood,
                        cityIbgeCode: company.address.cityIbgeCode,
                    },
                },
                pixLimits: {
                    create: {
                        singleTransfer: pixLimits.singleTransfer,
                        daytime: pixLimits.daytime,
                        nighttime: pixLimits.nighttime,
                        monthly: pixLimits.monthly,
                        serviceId: pixLimits.serviceId,
                    },
                },
                ownerships: {
                    create: company.ownershipStructure.map((o) => ({
                        name: o.name,
                        cpf: onlyDigits(o.cpf),
                        birthday: new Date(o.birthday),
                        isAdministrator: o.isAdministrator,
                    })),
                },
            },
            include: { address: true, pixLimits: true, ownerships: true },
        });
    }

    async list(params: ListCustomersDto) {
        const { q, type, status, page, pageSize } = params;
        const where: any = {};

        if (type) where.type = type;
        if (status) where.accountStatus = status;

        if (q) {
            const like = q.trim();
            where.OR = [
                { email: { contains: like, mode: 'insensitive' } },
                { phone: { contains: like, mode: 'insensitive' } },
                { name: { contains: like, mode: 'insensitive' } },
                { legalName: { contains: like, mode: 'insensitive' } },
                { tradeName: { contains: like, mode: 'insensitive' } },
                { cpf: { contains: onlyDigits(like) } },
                { cnpj: { contains: onlyDigits(like) } },
            ];
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.customer.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { address: true, pixLimits: true, ownerships: true },
            }),
            this.prisma.customer.count({ where }),
        ]);

        return { items, total, page, pageSize };
    }

    async findById(id: string) {
        return this.prisma.customer.findUnique({
            where: { id },
            include: { address: true, pixLimits: true, ownerships: true },
        });
    }

    async findByUserId(userId: string) {
        // pressupõe que você tem unique index em userId na tabela Customer
        return this.prisma.customer.findUnique({
            where: { userId },
            include: { address: true, pixLimits: true, ownerships: true },
        });
    }

    async resolveCustomerId(taxNumber?: string) {
        if (!taxNumber) return null;
        const clean = onlyDigits(taxNumber);
        let found: any = null;

        if (clean.length === 11) {
            found = await this.prisma.customer.findFirst({ where: { cpf: clean } });
        } else if (clean.length === 14) {
            found = await this.prisma.customer.findFirst({ where: { cnpj: clean } });
        } else {
            return null;
        }
        return found?.id ?? null;
    }

    async update(id: string, input: UpdateCustomerDto) {
        const data: any = {};

        if (input.type) data.type = input.type;
        if (input.accountStatus) data.accountStatus = input.accountStatus;
        if (input.identifier) data.identifier = input.identifier;
        if (typeof input.productId === 'number') data.productId = input.productId;
        if (input.email) data.email = input.email;
        if (input.phone) data.phone = input.phone;

        if (input.name) data.name = input.name;
        if (input.socialName) data.socialName = input.socialName;
        if (input.cpf) data.cpf = onlyDigits(input.cpf);
        if (input.birthday) data.birthday = new Date(input.birthday);
        if (typeof input.genderId === 'number') data.genderId = input.genderId;

        if (input.legalName) data.legalName = input.legalName;
        if (input.tradeName) data.tradeName = input.tradeName;
        if (input.cnpj) data.cnpj = onlyDigits(input.cnpj);

        if (input.address) {
            data.address = {
                upsert: {
                    create: {
                        zipCode: input.address.zipCode,
                        street: input.address.street,
                        number: input.address.number ?? null,
                        complement: input.address.complement ?? null,
                        neighborhood: input.address.neighborhood,
                        cityIbgeCode: input.address.cityIbgeCode,
                    },
                    update: {
                        zipCode: input.address.zipCode,
                        street: input.address.street,
                        number: input.address.number ?? null,
                        complement: input.address.complement ?? null,
                        neighborhood: input.address.neighborhood,
                        cityIbgeCode: input.address.cityIbgeCode,
                    },
                },
            };
        }

        if (input.pixLimits) {
            data.pixLimits = {
                upsert: {
                    create: {
                        singleTransfer: input.pixLimits.singleTransfer,
                        daytime: input.pixLimits.daytime,
                        nighttime: input.pixLimits.nighttime,
                        monthly: input.pixLimits.monthly,
                        serviceId: input.pixLimits.serviceId,
                    },
                    update: {
                        singleTransfer: input.pixLimits.singleTransfer,
                        daytime: input.pixLimits.daytime,
                        nighttime: input.pixLimits.nighttime,
                        monthly: input.pixLimits.monthly,
                        serviceId: input.pixLimits.serviceId,
                    },
                },
            };
        }

        if (input.ownerships) {
            await this.prisma.ownership.deleteMany({ where: { customerId: id } });
            data.ownerships = {
                create: input.ownerships.map((o) => ({
                    name: o.name,
                    cpf: onlyDigits(o.cpf),
                    birthday: new Date(o.birthday),
                    isAdministrator: o.isAdministrator,
                })),
            };
        }

        return this.prisma.customer.update({
            where: { id },
            data,
            include: { address: true, pixLimits: true, ownerships: true },
        });
    }

    async remove(id: string) {
        await this.prisma.ownership.deleteMany({ where: { customerId: id } });
        await this.prisma.address.deleteMany({ where: { customerId: id } });
        await this.prisma.pixLimits.deleteMany({ where: { customerId: id } });
        return this.prisma.customer.delete({ where: { id } });
    }

    // 🔹 usado em POST /customers/submit-kyc
    async submitKycByUser(userId: string) {
        const customer = await this.findByUserId(userId);
        if (!customer) return null;
        return this.update(customer.id, { accountStatus: AccountStatusDto.requested });
    }
}
