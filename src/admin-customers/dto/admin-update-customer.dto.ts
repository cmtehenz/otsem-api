import { IsEnum, IsOptional, IsString, IsEmail, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountStatus } from '@prisma/client';
import { AddressDto, PixLimitsDto } from '../../accreditation/dto/common.dto';

export class AdminUpdateCustomerDto {
    @IsOptional()
    @IsEnum(AccountStatus)
    accountStatus?: AccountStatus;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    externalClientId?: string;

    @IsOptional()
    @IsString()
    externalAccredId?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => PixLimitsDto)
    pixLimits?: PixLimitsDto;
}