import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InterModule } from '../inter/inter.module';
import { OkxModule } from '../okx/okx.module';
import { FdbankModule } from '../fdbank/fdbank.module';

import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => InterModule),
    forwardRef(() => OkxModule),
    forwardRef(() => FdbankModule),
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule { }
