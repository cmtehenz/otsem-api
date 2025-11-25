import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { StatementsModule } from './statements/statements.module';
import { MailModule } from './mail/mail.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { InterModule } from './inter/inter.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsModule } from './accounts/accounts.module';
import { PaymentsModule } from './payments/payments.module';
import { OkxModule } from './okx/okx.module';
import { FdbankModule } from './fdbank/fdbank.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccountsModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    StatementsModule,
    FdbankModule,
    WalletModule,
    OkxModule,
    MailModule,
    AdminDashboardModule,
    InterModule,
    PaymentsModule,
    TransactionsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
