import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
    ValidateNested,
    Matches,
    Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from '../../common/dto/address.dto';

export enum CustomerType {
    PF = 'PF',
    PJ = 'PJ',
}

export class CreateCustomerLocalDto {
    @ApiProperty({ enum: CustomerType, example: 'PF' })
    @IsEnum(CustomerType)
    type: CustomerType;

    @ApiProperty({ example: 'João Silva' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'joao@email.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ example: '+5511999999999' })
    @IsOptional()
    @IsString()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Telefone inválido' })
    phone?: string;

    // ============ PESSOA FÍSICA ============
    @ApiPropertyOptional({ example: '12345678901' })
    @ValidateIf((o) => o.type === CustomerType.PF)
    @IsNotEmpty({ message: 'CPF obrigatório para PF' })
    @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos' })
    cpf?: string;

    @ApiPropertyOptional({ example: '1990-01-15' })
    @ValidateIf((o) => o.type === CustomerType.PF)
    @IsNotEmpty({ message: 'Data de nascimento obrigatória para PF' })
    @IsString()
    birthday?: string; // <-- was birthdate

    @ApiPropertyOptional({ example: '123456789' })
    @ValidateIf((o) => o.type === CustomerType.PF)
    @IsOptional()
    @IsString()
    rg?: string;

    @ApiPropertyOptional({ example: 'João Silva' })
    @ValidateIf((o) => o.type === CustomerType.PF)
    @IsOptional()
    @IsString()
    mothersName?: string;

    // ============ PESSOA JURÍDICA ============
    @ApiPropertyOptional({ example: '12345678000190' })
    @ValidateIf((o) => o.type === CustomerType.PJ)
    @IsNotEmpty({ message: 'CNPJ obrigatório para PJ' })
    @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 dígitos' })
    cnpj?: string;

    @ApiPropertyOptional({ example: 'Empresa LTDA' })
    @ValidateIf((o) => o.type === CustomerType.PJ)
    @IsOptional()
    @IsString()
    companyName?: string;

    @ApiPropertyOptional({ example: 'Empresa' })
    @ValidateIf((o) => o.type === CustomerType.PJ)
    @IsOptional()
    @IsString()
    tradingName?: string;

    @ApiPropertyOptional({ example: '2020-01-01' })
    @ValidateIf((o) => o.type === CustomerType.PJ)
    @IsOptional()
    @IsString()
    foundingDate?: string;

    // ============ ENDEREÇO ============
    @ApiPropertyOptional({ type: AddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;

    // ============ METADATA ============
    @ApiPropertyOptional({ example: { referralCode: 'XYZ123' } })
    @IsOptional()
    metadata?: Record<string, any>;
}