// src/brx-pix/brx-pix.module.ts
import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { BrxAuthService } from "./brx-auth.service";

@Module({
    imports: [
        ConfigModule,
        HttpModule.register({
            timeout: 15000,
            // baseURL opcional (já uso no service via this.baseUrl)
        }),
    ],

    providers: [BrxAuthService],
    exports: [BrxAuthService],
})
export class BrxPixModule { }
