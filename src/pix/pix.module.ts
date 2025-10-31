import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PixService } from './pix.service';
import { PixController } from './pix.controller';
import { BrxAuthService } from '../brx/brx-auth.service';

@Module({
    imports: [HttpModule],
    providers: [PixService, BrxAuthService],
    controllers: [PixController],
    exports: [PixService],
})
export class PixModule { }
