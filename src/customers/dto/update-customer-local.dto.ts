import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CreateCustomerLocalDto } from './create-customer-local.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountStatus } from '@prisma/client'; // usar enum do Prisma

export { AccountStatus }; // opcional: exportar para reuso

export class UpdateCustomerLocalDto extends PartialType(
    OmitType(CreateCustomerLocalDto, ['type', 'cpf', 'cnpj'] as const)
) {
    @ApiPropertyOptional({ enum: AccountStatus })
    @IsOptional()
    @IsEnum(AccountStatus)
    accountStatus?: AccountStatus; // agora é o tipo do Prisma
}