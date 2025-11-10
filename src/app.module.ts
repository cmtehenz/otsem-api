import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { PixModule } from './pix/pix.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BrxWebhooksModule } from './brx-webhooks/brx-webhooks.module';
import { BrxPixModule } from './brx/brx-pix.module';
import { PixTransactionsModule } from './pix-transactions/pix-transactions.module';
import { AccreditationModule } from './accreditation/accreditation.module';
import { PixLimitsModule } from './pix/limits/pix-limits.module';
import { CustomersModule } from './customers/customers.module';
import { AdminCustomersModule } from './admin-customers/admin-customers.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PixModule,
    AuthModule,
    UsersModule,
    BrxWebhooksModule,
    BrxPixModule,
    PixTransactionsModule,
    AccreditationModule,
    PixLimitsModule,
    CustomersModule,
    AdminCustomersModule
  ],
  providers: [PrismaService],
})
export class AppModule { }
