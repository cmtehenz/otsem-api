// src/inter/dto/register-pix-key.dto.ts

import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PixKeyType {
    CPF = 'CPF',
    CNPJ = 'CNPJ',
    EMAIL = 'EMAIL',
    TELEFONE = 'TELEFONE',
    ALEATORIA = 'ALEATORIA',
}

export class RegisterPixKeyDto {
    @ApiProperty({
        enum: PixKeyType,
        example: PixKeyType.CPF,
        description: 'Tipo da chave Pix',
    })
    @IsEnum(PixKeyType)
    tipoChave: PixKeyType;

    @ApiPropertyOptional({
        example: '12345678901',
        description: 'Valor da chave (obrigatório para CPF, CNPJ, EMAIL, TELEFONE)',
    })
    @IsOptional()
    @IsString()
    chave?: string;
}

export class RegisterRandomPixKeyDto {
    @ApiProperty({
        example: 'customer-uuid',
        description: 'ID do customer',
    })
    @IsString()
    customerId: string;
}