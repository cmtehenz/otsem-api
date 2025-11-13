import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InterModule } from '../inter/inter.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [
    PrismaModule,
    InterModule, // Importing InterModule to use InterBankingService
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule { }
