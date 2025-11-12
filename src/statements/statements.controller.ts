// src/statements/statements.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { StatementsService } from './statements.service';
import { StatementQueryDto } from './dto/statement-query.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Statements')
@ApiBearerAuth()
@Controller('statements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatementsController {
  constructor(
    private readonly service: StatementsService,
    private readonly prisma: PrismaService,
  ) { }

  // Validar se o user tem acesso ao accountHolderId
  private async validateAccess(
    accountHolderId: string,
    user: any,
  ): Promise<void> {
    if (user.role === Role.ADMIN) return; // Admin pode tudo

    // Buscar customer pelo externalClientId
    const customer = await this.prisma.customer.findFirst({
      where: { externalClientId: accountHolderId },
    });

    if (!customer || customer.userId !== user.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }
  }

  // Consultar saldo
  @Get('account-holders/:accountHolderId/balance')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  async getBalance(
    @Request() req: any,
    @Param('accountHolderId') accountHolderId: string,
  ) {
    await this.validateAccess(accountHolderId, req.user);
    return this.service.getBalance(accountHolderId);
  }

  // Consultar extrato
  @Get('account-holders/:accountHolderId')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  async getStatement(
    @Request() req: any,
    @Param('accountHolderId') accountHolderId: string,
    @Query() query: StatementQueryDto,
  ) {
    await this.validateAccess(accountHolderId, req.user);
    return this.service.getStatement(
      accountHolderId,
      query.page ?? 1,
      query.limit ?? 50,
      query.startDate,
      query.endDate,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Extrato do customer logado' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  async myStatement(@Request() req: any, @Query() query: StatementQueryDto) {
    const customerId = req.user.customerId;
    return this.service.getCustomerStatement(customerId, query);
  }

  @Get('admin/:customerId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Extrato por customerId (Admin)' })
  @ApiParam({ name: 'customerId' })
  async byCustomerAdmin(@Param('customerId') customerId: string, @Query() query: StatementQueryDto) {
    return this.service.getStatementByCustomerIdAdmin(customerId, query);
  }
}


