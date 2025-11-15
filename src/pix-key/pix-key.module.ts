import { Module } from '@nestjs/common';
import { PixKeyController } from './pix-key.controller';
import { PixKeyService } from './pix-key.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [PixKeyController],
    providers: [PixKeyService, PrismaService],
    exports: [PixKeyService],
})
export class PixKeyModule { }