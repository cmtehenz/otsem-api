import { Controller, Get, Post, Patch, Put, Body, Param, Query } from '@nestjs/common';
import { PixKeyService } from './pix-key.service';

@Controller('pix-keys')
export class PixKeyController {
    constructor(private readonly pixKeyService: PixKeyService) { }

    @Get(':id')
    async getPixKey(@Param('id') id: string) {
        return this.pixKeyService.findById(id);
    }

    @Get('customer/:customerId')
    async getPixKeysByCustomer(@Param('customerId') customerId: string) {
        return this.pixKeyService.findByCustomerId(customerId);
    }

    @Get()
    async listPixKeys(@Query('customerId') customerId: string) {
        return this.pixKeyService.findByCustomerId(customerId);
    }

    @Post()
    async createPixKey(@Body() dto: { customerId: string; keyType: string; keyValue: string; status?: string }) {
        return this.pixKeyService.create(dto);
    }

    @Patch(':id')
    async updatePixKey(@Param('id') id: string, @Body() dto: { keyType?: string; keyValue?: string; status?: string }) {
        return this.pixKeyService.update(id, dto);
    }
}