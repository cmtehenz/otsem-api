import { Module, forwardRef } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { InterModule } from '../inter/inter.module';
import { OkxModule } from '../okx/okx.module';
import { TronModule } from '../tron/tron.module';
import { SolanaModule } from '../solana/solana.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { SellProcessingService } from './sell-processing.service';

@Module({
    imports: [InterModule, OkxModule, TronModule, SolanaModule, forwardRef(() => AffiliatesModule)],
    providers: [WalletService, PrismaService, InterPixService, SellProcessingService],
    controllers: [WalletController],
    exports: [SellProcessingService],
})
export class WalletModule { }