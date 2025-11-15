import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PixKeyService {
    constructor(private readonly prisma: PrismaService) { }

    async findById(id: string) {
        return this.prisma.pixKey.findUnique({ where: { id } });
    }

    async findByCustomerId(customerId: string) {
        return this.prisma.pixKey.findMany({ where: { customerId } });
    }

    async create(dto: { customerId: string; keyType: string; keyValue: string; status?: string }) {
        return this.prisma.pixKey.create({
            data: {
                customerId: dto.customerId,
                keyType: dto.keyType as any, // ou PixKeyType se importar o enum
                keyValue: dto.keyValue,
                status: (dto.status ?? 'ACTIVE') as any, // ou PixKeyStatus
            },
        });
    }

    async update(id: string, dto: { keyType?: string; keyValue?: string; status?: string }) {
        return this.prisma.pixKey.update({
            where: { id },
            data: {
                ...(dto.keyType && { keyType: dto.keyType as any }),
                ...(dto.keyValue && { keyValue: dto.keyValue }),
                ...(dto.status && { status: dto.status as any }),
            },
        });
    }
}