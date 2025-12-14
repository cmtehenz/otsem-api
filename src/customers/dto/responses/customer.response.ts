import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerResponse {
    @ApiProperty()
    id: string;

    @ApiProperty()
    userId: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    email: string;

    @ApiPropertyOptional()
    phone?: string;

    @ApiPropertyOptional()
    cpf?: string;

    @ApiPropertyOptional()
    cnpj?: string;

    @ApiProperty()
    accountStatus: string;

    @ApiPropertyOptional()
    externalClientId?: string;

    @ApiPropertyOptional()
    externalAccredId?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    // Acrescente se quiser incluir birthday e status legível
    @ApiPropertyOptional()
    birthday?: Date;

    @ApiPropertyOptional()
    statusLabel?: string;
}

export class PaginatedCustomersResponse {
    @ApiProperty({ type: [CustomerResponse] })
    data: CustomerResponse[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    totalPages: number;
}