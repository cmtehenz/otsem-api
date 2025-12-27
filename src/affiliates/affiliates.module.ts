import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AffiliatesService } from './affiliates.service';
import { AffiliatesController, PublicAffiliatesController } from './affiliates.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AffiliatesController, PublicAffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
