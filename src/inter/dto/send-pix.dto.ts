// src/inter/dto/send-pix.dto.ts

import { IsNumber, IsString, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendPixDto {
    @ApiProperty({ example: '12345678901', description: 'Chave Pix de destino' })
    @IsString()
    chaveDestino: string;

    @ApiProperty({ example: 50.00, description: 'Valor a enviar' })
    @IsNumber()
    @Min(0.01)
    valor: number;

    @ApiProperty({
        example: 'Pagamento de serviço',
        description: 'Descrição do pagamento',
        required: false
    })
    @IsOptional()
    @IsString()
    descricao?: string;
}