import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminConversionsService } from './admin-conversions.service';
import { QueryConversionsDto } from './dto/query-conversions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Conversions')
@ApiBearerAuth()
@Controller('admin/conversions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminConversionsController {
  constructor(private readonly service: AdminConversionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas as conversões BRL→USDT' })
  @ApiResponse({ status: 200, description: 'Lista de conversões' })
  async list(@Query() query: QueryConversionsDto) {
    return this.service.listConversions(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas agregadas de conversões' })
  @ApiResponse({ status: 200, description: 'Estatísticas' })
  async stats(@Query() query: QueryConversionsDto) {
    return this.service.getConversionStats(query);
  }
}
