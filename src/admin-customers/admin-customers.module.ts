// src/admin-customers/admin-customers.module.ts
import { Module } from '@nestjs/common';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AdminCustomersController],
    providers: [AdminCustomersService],
    exports: [AdminCustomersService],
})
export class AdminCustomersModule { }
