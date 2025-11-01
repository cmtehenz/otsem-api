// src/pix/transactions.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PixTransactionsService } from './pix-transactions.service';
import { PixTransactionsController } from './pix-transactions.controller';
import { BrxPixModule } from '../brx/brx-pix.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [
        HttpModule,        // <- necessário para injetar HttpService
        PrismaModule,
        BrxPixModule,      // <- exporta BrxAuthService
    ],
    controllers: [PixTransactionsController],
    providers: [PixTransactionsService],
    exports: [PixTransactionsService],
})
export class PixTransactionsModule { }
