import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashOutService } from './cashout.service';
import { CashOutController } from './cashout.controller';
import { BrxClient } from './brx.client';

@Module({
    controllers: [CashOutController],
    providers: [PrismaService, CashOutService, BrxClient],
})
export class CashOutModule { }
