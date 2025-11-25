import { Module } from '@nestjs/common';
import { PixKeysService } from './pix-keys.service';
import { PixKeysController } from './pix-keys.controller';
import { PrismaModule } from '../prisma/prisma.module'; // ajuste o caminho se necessário

@Module({
    imports: [PrismaModule],
    providers: [PixKeysService],
    controllers: [PixKeysController],
    exports: [PixKeysService],
})
export class PixKeysModule { }