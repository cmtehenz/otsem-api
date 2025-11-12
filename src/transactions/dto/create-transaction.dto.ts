// src/transactions/dto/create-transaction.dto.ts

import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionDto {
    @ApiProperty({ example: 100.00, description: 'Valor da transação' })
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiProperty({ example: 'PIX_IN', description: 'Tipo de transação' })
    @IsString()
    type: string;

    @ApiPropertyOptional({ example: 'Depósito via Pix', description: 'Descrição' })
    @IsOptional()
    @IsString()
    description?: string;
}