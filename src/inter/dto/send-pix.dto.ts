// src/inter/dto/send-pix.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, IsEnum, MaxLength } from 'class-validator';

export enum PixKeyType {
    CPF = 'CPF',
    CNPJ = 'CNPJ',
    EMAIL = 'EMAIL',
    TELEFONE = 'TELEFONE',
    CHAVE_ALEATORIA = 'CHAVE_ALEATORIA',
}

export class SendPixDto {
    @ApiProperty({
        example: 100.50,
        description: 'Valor em reais',
        minimum: 0.01,
    })
    @IsNumber()
    @Min(0.01, { message: 'Valor mínimo é R$ 0,01' })
    valor: number;

    @ApiProperty({
        example: '12345678900',
        description: 'Chave Pix do destinatário',
    })
    @IsString()
    chaveDestino: string;

    @ApiProperty({
        enum: PixKeyType,
        example: 'CPF',
        description: 'Tipo da chave Pix',
    })
    @IsEnum(PixKeyType)
    tipoChave: PixKeyType;

    @ApiPropertyOptional({
        example: 'Pagamento de serviço',
        description: 'Descrição (máximo 140 caracteres)',
        maxLength: 140,
    })
    @IsOptional()
    @IsString()
    @MaxLength(140, { message: 'Descrição deve ter no máximo 140 caracteres' })
    descricao?: string;

    @ApiPropertyOptional({
        example: 'João Silva',
        description: 'Nome do favorecido (opcional)',
    })
    @IsOptional()
    @IsString()
    nomeFavorecido?: string;

    customerId?: string;
}

export class PixPaymentResponseDto {
    @ApiProperty({ example: 'E123456789012345678901234567890AB' })
    endToEndId: string;

    @ApiProperty({ example: 100.50 })
    valor: number;

    @ApiProperty({ example: '2025-11-13T14:30:00Z' })
    horario: string;

    @ApiProperty({ example: 'PROCESSANDO' })
    status: string;

    @ApiProperty({ example: 'abc123' })
    transacaoId?: string;
}