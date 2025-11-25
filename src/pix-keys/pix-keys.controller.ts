import { Controller, Get, Param } from '@nestjs/common';
import { PixKeysService } from './pix-keys.service';

@Controller('pix-keys')
export class PixKeysController {
    constructor(private readonly pixKeysService: PixKeysService) { }

    @Get('customer/:customerId')
    async getKeysByCustomer(@Param('customerId') customerId: string) {
        return await this.pixKeysService.getKeysByCustomer(customerId);
    }
}