// src/pix/pix.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { PixService } from './pix.service';
import { CreatePixKeyDto, BrxCreateKeyRaw } from './dtos/create-key.dto';
import { ListKeysResponseDto } from './dtos/list-keys.dto';
import { PrecheckKeyResponseDto } from './dtos/precheck-key.dto';

@Controller('pix/keys')
export class PixController {
    constructor(private readonly pix: PixService) { }

    @Get('account-holders/:accountHolderId')
    listAllKeys(
        @Param('accountHolderId') accountHolderId: string,
    ): Promise<ListKeysResponseDto> {
        return this.pix.listKeys(accountHolderId);
    }

    @Post('account-holders/:accountHolderId')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    createKey(
        @Param('accountHolderId') accountHolderId: string,
        @Body() body: CreatePixKeyDto,
    ): Promise<BrxCreateKeyRaw> {
        return this.pix.createKey(accountHolderId, { keyType: body.keyType, pixKey: body.pixKey });
    }

    @Get('account-holders/:accountHolderId/key/:pixKey')
    precheck(
        @Param('accountHolderId') accountHolderId: string,
        @Param('pixKey') pixKey: string,
        @Query('value') value?: string, // opcional
    ): Promise<PrecheckKeyResponseDto> {
        return this.pix.precheckKey(accountHolderId, pixKey, value);
    }

    @Delete('account-holders/:accountHolderId/key/:pixKey')
    remove(
        @Param('accountHolderId') accountHolderId: string,
        @Param('pixKey') pixKey: string,
    ): Promise<{ ok: true; message?: string }> {
        return this.pix.deleteKey(accountHolderId, pixKey);
    }
}
