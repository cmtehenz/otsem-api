import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import okxConfig from './okx.config';
import { OkxService } from './services/okx.service';
import { OkxController } from './okx.controller';
import { OkxAuthService } from './services/okx-auth.service';

@Module({
    imports: [ConfigModule.forFeature(okxConfig)],
    providers: [OkxService, OkxAuthService],
    controllers: [OkxController],
    exports: [OkxService],
})
export class OkxModule { }