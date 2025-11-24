import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import fdbankConfig from './fdbank.config';
import { FdbankService } from './services/fdbank.service';
import { FdbankController } from './controllers/fdbank.controller';

@Module({
    imports: [ConfigModule.forFeature(fdbankConfig)],
    providers: [FdbankService],
    controllers: [FdbankController],
    exports: [FdbankService],
})
export class FdbankModule { }