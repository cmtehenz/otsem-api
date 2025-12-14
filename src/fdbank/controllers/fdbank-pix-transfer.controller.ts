import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FdbankPixTransferService } from '../services/fdbank-pix-transfer.service';
import { GeneratePixQrCodeDto } from '../dto/generate-qrcode.dto';

@ApiTags('FDBank PIX Transfer')
@Controller('fdbank/pix-transfer')
export class FdbankPixTransferController {
    constructor(private readonly pixTransferService: FdbankPixTransferService) { }

    @Post()
    @ApiOperation({ summary: 'Criar transferência PIX' })
    async createPixTransfer(@Body() data: any) {
        return await this.pixTransferService.createPixTransfer(data);
    }

    @Post('generate-dynamic-qrcode')
    @ApiOperation({ summary: 'Gerar QR Code PIX dinâmico (valor mínimo R$ 10,00)' })
    @ApiResponse({ status: 200, description: 'QR Code gerado com sucesso' })
    @ApiResponse({ status: 400, description: 'Valor mínimo não atingido ou dados inválidos' })
    async generatePixDynamicQrCode(@Body() dto: GeneratePixQrCodeDto) {
        try {
            return await this.pixTransferService.generatePixDynamicQrCode(
                dto.pixKeyId,
                dto.value,
                dto.message,
                dto.externalId,
            );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data || error.message || 'Erro ao gerar QR Code',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post('capture-qrcode')
    @ApiOperation({ summary: 'Capturar dados de um QR Code PIX' })
    async captureQrCode(@Body() data: any) {
        return await this.pixTransferService.captureQrCode(data);
    }
}