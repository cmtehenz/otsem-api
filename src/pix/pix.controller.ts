import { Controller, Get, Param } from '@nestjs/common';
import { PixService } from './pix.service';
import { ListKeysResponseDto } from './dtos/list-keys.dto';

@Controller('pix/keys')
export class PixController {
    constructor(private readonly pix: PixService) { }

    @Get('account-holders/:accountHolderId')
    async listAllKeys(
        @Param('accountHolderId') accountHolderId: string,
    ): Promise<ListKeysResponseDto> {
        return this.pix.listKeys(accountHolderId);
    }
}
