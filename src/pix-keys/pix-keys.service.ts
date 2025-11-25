import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PixKeysService {
    constructor(private readonly prisma: PrismaService) { }

    async getKeysByCustomer(customerId: string) {
        return this.prisma.pixKey.findMany({
            where: { customerId },
        });
    }
}