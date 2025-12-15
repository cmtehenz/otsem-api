// src/inter/dto/create-pix-charge.dto.ts

import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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

    @ApiProperty({
        example: '572aac8c-949e-40d5-8b87-66cc164e9000',
        description: 'ID do customer (opcional - usa do token JWT se não informado)',
        required: false
    })
    @IsOptional()
    @IsString()
    customerId?: string;
}