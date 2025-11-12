import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class StatementQueryDto {
    @ApiPropertyOptional({ description: 'Data inicial (ISO)', example: '2025-11-01T00:00:00Z' })
    @IsOptional()
    @IsDateString()
    from?: string;

    @ApiPropertyOptional({ description: 'Data final (ISO)', example: '2025-11-12T23:59:59Z' })
    @IsOptional()
    @IsDateString()
    to?: string;

    @ApiPropertyOptional({ description: 'Limite de transações', example: 200, default: 200 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    limit?: number;

    @ApiPropertyOptional({
        description: 'Tipo da transação (ex: PIX_IN, PIX_OUT, TRANSFER_IN, TRANSFER_OUT)',
        example: 'PIX_IN',
    })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({ description: 'Status da transação (ex: COMPLETED, PROCESSING)', example: 'COMPLETED' })
    @IsOptional()
    @IsString()
    status?: string;

    page?: number;

    startDate?: string; // or Date, depending on your usage
    endDate?: string;
}