import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class QueryConversionsDto {
  @ApiPropertyOptional({ description: 'Data início (ISO)' })
  @IsOptional()
  @IsDateString()
  dateStart?: string;

  @ApiPropertyOptional({ description: 'Data fim (ISO)' })
  @IsOptional()
  @IsDateString()
  dateEnd?: string;

  @ApiPropertyOptional({ description: 'ID do cliente' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'ID do afiliado' })
  @IsOptional()
  @IsString()
  affiliateId?: string;

  @ApiPropertyOptional({ enum: TransactionStatus, description: 'Status da conversão' })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
