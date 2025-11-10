// src/admin-customers/dto/admin-list-customers.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountStatus, CustomerType } from '@prisma/client';

export class AdminListCustomersDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    limit?: number = 20;

    @IsOptional()
    @IsEnum(CustomerType)
    type?: CustomerType;

    @IsOptional()
    @IsEnum(AccountStatus)
    accountStatus?: AccountStatus;

    @IsOptional()
    @IsString()
    search?: string; // busca por nome, email, cpf, cnpj

    @IsOptional()
    @IsString()
    userId?: string; // filtrar por usuário vinculado
}
