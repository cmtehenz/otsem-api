import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InterModule } from '../inter/inter.module';
import { PrismaModule } from '../prisma/prisma.module'; // Adicione esta linha

@Module({
    imports: [InterModule, PrismaModule], // Adicione PrismaModule aqui
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule { }