import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { KycUpgradeService } from './kyc-upgrade.service';
import { KycLevel, KycUpgradeRequestStatus } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

interface DocumentDto {
  name: string;
  objectPath: string;
}

interface CreateUpgradeRequestDto {
  targetLevel: KycLevel;
  documents: DocumentDto[];
}

interface RejectRequestDto {
  reason: string;
}

const kycUpgradeStorage = diskStorage({
  destination: './uploads/kyc-upgrades',
  filename: (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
    const uniqueId = uuidv4();
    const ext = extname(file.originalname);
    callback(null, `${uniqueId}${ext}`);
  },
});

@ApiTags('KYC Upgrade')
@ApiBearerAuth()
@Controller()
export class KycUpgradeController {
  constructor(private readonly kycUpgradeService: KycUpgradeService) {}

  @Post('customers/kyc-upgrade-requests')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('documents', 10, { storage: kycUpgradeStorage }))
  @ApiOperation({ summary: 'Criar solicitação de upgrade de KYC' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        targetLevel: { type: 'string', enum: ['LEVEL_2', 'LEVEL_3'] },
        documents: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  async createRequest(
    @Req() req: any,
    @Body('targetLevel') targetLevel: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const customerId = req.user.customerId;
    
    if (!targetLevel) {
      throw new BadRequestException('targetLevel é obrigatório');
    }

    const documents = (files || []).map(file => ({
      name: file.originalname,
      objectPath: `/uploads/kyc-upgrades/${file.filename}`,
    }));

    return this.kycUpgradeService.createRequest(customerId, {
      targetLevel: targetLevel as KycLevel,
      documents,
    });
  }

  @Get('customers/me/kyc-upgrade-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar minhas solicitações de upgrade' })
  async getMyRequests(@Req() req: any) {
    const customerId = req.user.customerId;
    return this.kycUpgradeService.getMyRequests(customerId);
  }

  @Get('admin/kyc-upgrade-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar todas as solicitações de upgrade (admin)' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  async listRequests(@Query('status') status?: KycUpgradeRequestStatus) {
    return this.kycUpgradeService.listRequests(status);
  }

  @Get('admin/kyc-upgrade-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Detalhes de uma solicitação (admin)' })
  async getRequestDetails(@Param('id') id: string) {
    return this.kycUpgradeService.getRequestDetails(id);
  }

  @Post('admin/kyc-upgrade-requests/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aprovar solicitação de upgrade (admin)' })
  async approveRequest(@Param('id') id: string, @Req() req: any) {
    const adminEmail = req.user.email;
    return this.kycUpgradeService.approveRequest(id, adminEmail);
  }

  @Post('admin/kyc-upgrade-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rejeitar solicitação de upgrade (admin)' })
  async rejectRequest(
    @Param('id') id: string,
    @Body() body: RejectRequestDto,
    @Req() req: any,
  ) {
    const adminEmail = req.user.email;
    return this.kycUpgradeService.rejectRequest(id, adminEmail, body.reason);
  }
}
