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
import { MailModule } from './mail/mail.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { InterModule } from './inter/inter.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsModule } from './accounts/accounts.module';
import { PixKeyModule } from './pix-key/pix-key.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccountsModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    AccreditationModule,
    StatementsModule,
    PixModule,
    PixLimitsModule,
    PixTransactionsModule,
    // BrxPixModule,
    // BrxWebhooksModule,
    MailModule,
    AdminDashboardModule,
    InterModule,
    PixKeyModule,
    TransactionsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
