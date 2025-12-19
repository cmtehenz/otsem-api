import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { PixKeysService } from './pix-keys.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { PixKeyType } from '@prisma/client';

class CreatePixKeyDto {
    keyType: PixKeyType;
    keyValue: string;
}

@ApiTags('PIX Keys')
@Controller('pix-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PixKeysController {
    constructor(private readonly pixKeysService: PixKeysService) { }

    @Get()
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Listar chaves PIX do usuário logado' })
    @ApiResponse({ status: 200, description: 'Lista de chaves PIX com status de validação' })
    async getMyKeys(@Request() req: any) {
        const customerId = req.user?.customerId;
        return this.pixKeysService.getKeysByCustomer(customerId);
    }

    @Get('customer/:customerId')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Listar chaves PIX por customer (Admin)' })
    async getKeysByCustomer(@Param('customerId') customerId: string) {
        return this.pixKeysService.getKeysByCustomer(customerId);
    }

    @Post()
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Cadastrar nova chave PIX' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['keyType', 'keyValue'],
            properties: {
                keyType: { 
                    type: 'string', 
                    enum: ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'],
                    description: 'Tipo da chave PIX'
                },
                keyValue: { 
                    type: 'string', 
                    description: 'Valor da chave (CPF, CNPJ, email, telefone ou UUID)'
                },
            },
        },
    })
    @ApiResponse({ 
        status: 201, 
        description: 'Chave criada. Campo validated indica se pertence ao CPF/CNPJ do titular' 
    })
    async createKey(@Request() req: any, @Body() dto: CreatePixKeyDto) {
        const customerId = req.user?.customerId;
        return this.pixKeysService.createPixKey(customerId, dto.keyType, dto.keyValue);
    }

    @Patch(':id/status')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Atualizar status da chave PIX (Admin)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                status: { 
                    type: 'string', 
                    enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED'],
                    description: 'Novo status da chave'
                },
            },
        },
    })
    async updateKeyStatus(
        @Request() req: any,
        @Param('id') id: string,
        @Body() dto: { status: any },
    ) {
        const customerId = req.user?.customerId;
        return this.pixKeysService.updatePixKey(customerId, id, { status: dto.status });
    }

    @Delete(':id')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Excluir chave PIX' })
    async deleteKey(@Request() req: any, @Param('id') id: string) {
        const customerId = req.user?.customerId;
        return this.pixKeysService.deletePixKey(customerId, id);
    }
}
