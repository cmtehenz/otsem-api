// src/brx-pix/brx-pix.module.ts
import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { BrxPixService } from "./brx-pix.service";
import { BrxPixController } from "./brx-pix.controller";

@Module({
    imports: [
        ConfigModule,
        HttpModule.register({
            timeout: 15000,
            // baseURL opcional (já uso no service via this.baseUrl)
        }),
    ],
    controllers: [BrxPixController],
    providers: [BrxPixService],
    exports: [BrxPixService],
})
export class BrxPixModule { }
