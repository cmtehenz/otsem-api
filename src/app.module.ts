import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { PixModule } from './pix/pix.module';
import { CashOutModule } from './pix/cashout.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BrxWebhooksModule } from './brx-webhooks/brx-webhooks.module';
import { BrxPixModule } from './brx-pix/brx-pix.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PixModule, CashOutModule, AuthModule, UsersModule, BrxWebhooksModule, BrxPixModule,

  ],
  providers: [PrismaService],
})
export class AppModule { }
