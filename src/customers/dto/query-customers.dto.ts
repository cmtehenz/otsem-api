import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from './create-customer-local.dto';
import { AccountStatus } from './update-customer-local.dto';

export class QueryCustomersDto {
    @ApiPropertyOptional({ example: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ example: 'João' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: CustomerType })
    @IsOptional()
    @IsEnum(CustomerType)
    type?: CustomerType;

    @ApiPropertyOptional({ enum: AccountStatus })
    @IsOptional()
    @IsEnum(AccountStatus)
    status?: AccountStatus;

    @ApiPropertyOptional({ example: '12345678901' })
    @IsOptional()
    @IsString()
    cpf?: string;

    @ApiPropertyOptional({ example: '12345678000190' })
    @IsOptional()
    @IsString()
    cnpj?: string;

    @ApiPropertyOptional({ example: 'joao@email.com' })
    @IsOptional()
    @IsString()
    email?: string;
}