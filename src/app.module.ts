import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { AccreditationModule } from './accreditation/accreditation.module';
import { StatementsModule } from './statements/statements.module';
import { PixModule } from './pix/pix.module';
import { PixLimitsModule } from './pix/limits/pix-limits.module';
import { PixTransactionsModule } from './pix-transactions/pix-transactions.module';
import { BrxPixModule } from './brx/brx-pix.module';
import { BrxWebhooksModule } from './brx-webhooks/brx-webhooks.module';
import { MailModule } from './mail/mail.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { InterModule } from './inter/inter.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    AccreditationModule,
    StatementsModule,
    PixModule,
    PixLimitsModule,
    PixTransactionsModule,
    BrxPixModule,
    BrxWebhooksModule,
    MailModule,
    AdminDashboardModule,
    InterModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
