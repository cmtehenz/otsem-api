import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class GeneratePixQrCodeDto {
    @ApiProperty({ description: 'ID da chave PIX cadastrada no FDBank' })
    @IsString()
    pixKeyId: string;

    @ApiProperty({ description: 'Valor do QR Code em reais (mínimo R$ 10,00)', minimum: 10 })
    @IsNumber()
    @Min(10, { message: 'Valor mínimo é R$ 10,00' })
    value: number;

    @ApiPropertyOptional({ description: 'Mensagem opcional para o pagador' })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiPropertyOptional({ description: 'ID externo para referência' })
    @IsOptional()
    @IsString()
    externalId?: string;
}
