// src/brx-pix/brx-pix.controller.ts
import { Controller, Get, Post, Body, Param, Query, Headers } from "@nestjs/common";
import { BrxPixService } from "./brx-pix.service";
import { CreateBrxPixKeyDto } from "./dto/create-brx-pix-key.dto";
import { PrecheckQueryDto } from "./dto/precheck-brx-pix-key.dto";

@Controller("integrations/brx/pix")
export class BrxPixController {
    constructor(private readonly brx: BrxPixService) { }

    /**
     * Consulta prévia de chave
     * GET /integrations/brx/pix/keys/:accountHolderId/key/:pixKey?value=10.00
     * Header opcional: Authorization: Bearer <token-dinamico>
     */
    @Get("keys/:accountHolderId/key/:pixKey")
    precheck(
        @Param("accountHolderId") accountHolderId: string,
        @Param("pixKey") pixKey: string,
        @Query() query: PrecheckQueryDto,
        @Headers("authorization") authorization?: string,
    ) {
        const bearer = authorization?.startsWith("Bearer ") ? authorization.replace(/^Bearer\s+/i, "") : undefined;
        return this.brx.precheckKey({
            accountHolderId,
            pixKey,
            value: query.value,
            bearer,
        });
    }

    /**
     * Cadastra nova chave
     * POST /integrations/brx/pix/keys/:accountHolderId
     * Body: { KeyType: '1' | '2' | ... | 'random', PixKey?: '...' }
     * Header opcional: Authorization: Bearer <token-dinamico>
     */
    @Post("keys/:accountHolderId")
    create(
        @Param("accountHolderId") accountHolderId: string,
        @Body() body: CreateBrxPixKeyDto,
        @Headers("authorization") authorization?: string,
    ) {
        const bearer = authorization?.startsWith("Bearer ") ? authorization.replace(/^Bearer\s+/i, "") : undefined;
        return this.brx.createKey({
            accountHolderId,
            body,
            bearer,
        });
    }
}

