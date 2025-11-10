import { IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested, IsEmail, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto, PixLimitsDto, OwnershipItemDto } from './common.dto';

export enum AccountStatusDto {
    not_requested = 'not_requested',
    requested = 'requested',
    approved = 'approved',
    rejected = 'rejected',
    in_review = 'in_review',
}

export enum CustomerTypeDto {
    PF = 'PF',
    PJ = 'PJ',
}

export class UpdateCustomerDto {
    @IsOptional() @IsEnum(CustomerTypeDto)
    type?: CustomerTypeDto;

    @IsOptional() @IsEnum(AccountStatusDto)
    accountStatus?: AccountStatusDto;

    @IsOptional() @IsString()
    identifier?: string;

    @IsOptional() @IsInt()
    productId?: number;

    @IsOptional() @IsEmail()
    email?: string;

    @IsOptional() @IsString()
    phone?: string;

    // PF
    @IsOptional() @IsString()
    name?: string;

    @IsOptional() @IsString()
    socialName?: string;

    @IsOptional() @IsString()
    cpf?: string;

    @IsOptional() @IsString()
    birthday?: string;

    @IsOptional() @IsInt()
    genderId?: number;

    // PJ
    @IsOptional() @IsString()
    legalName?: string;

    @IsOptional() @IsString()
    tradeName?: string;

    @IsOptional() @IsString()
    cnpj?: string;

    @IsOptional() @ValidateNested() @Type(() => AddressDto)
    address?: AddressDto;

    @IsOptional() @ValidateNested() @Type(() => PixLimitsDto)
    pixLimits?: PixLimitsDto;

    @IsOptional() @ValidateNested({ each: true }) @Type(() => OwnershipItemDto)
    ownerships?: OwnershipItemDto[];
}
