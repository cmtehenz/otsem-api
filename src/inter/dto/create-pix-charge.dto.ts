// src/inter/dto/create-pix-charge.dto.ts

import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePixChargeDto {
    @ApiProperty({ example: 100.50, description: 'Valor da cobrança' })
    @IsNumber()
    @Min(0.01)
    valor: number;

    @ApiProperty({
        example: 3600,
        description: 'Tempo de expiração em segundos (padrão: 1 hora)',
        required: false
    })
    @IsOptional()
    @IsNumber()
    expiracao?: number;

    @ApiProperty({
        example: 'Pagamento de serviço',
        description: 'Descrição da cobrança',
        required: false
    })
    @IsOptional()
    @IsString()
    descricao?: string;
}