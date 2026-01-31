import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycLevel, KycUpgradeRequest, KycUpgradeRequestStatus, Customer } from '@prisma/client';

interface DocumentInfo {
  name: string;
  objectPath: string;
}

interface CreateUpgradeRequestDto {
  targetLevel: KycLevel;
  documents: DocumentInfo[];
}

@Injectable()
export class KycUpgradeService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(customerId: string, dto: CreateUpgradeRequestDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { kycLevel: true },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const currentLevel = customer.kycLevel;
    const targetLevel = dto.targetLevel;

    const levelOrder = { LEVEL_1: 1, LEVEL_2: 2, LEVEL_3: 3 };
    if (levelOrder[targetLevel] <= levelOrder[currentLevel]) {
      throw new BadRequestException(
        `Nível solicitado (${targetLevel}) deve ser maior que o nível atual (${currentLevel})`,
      );
    }

    const existingPending = await this.prisma.kycUpgradeRequest.findFirst({
      where: {
        customerId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'Já existe uma solicitação de upgrade pendente. Aguarde a análise.',
      );
    }

    const request = await this.prisma.kycUpgradeRequest.create({
      data: {
        customerId,
        currentLevel,
        targetLevel,
        documents: JSON.parse(JSON.stringify(dto.documents)),
        status: 'PENDING',
      },
    });

    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  async getMyRequests(customerId: string) {
    const requests = await this.prisma.kycUpgradeRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        currentLevel: true,
        targetLevel: true,
        status: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
      },
    });

    return { data: requests };
  }

  async listRequests(status?: KycUpgradeRequestStatus) {
    const where = status ? { status } : {};

    const requests = await this.prisma.kycUpgradeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            cpf: true,
            cnpj: true,
            kycLevel: true,
          },
        },
      },
    });

    type RequestWithCustomer = KycUpgradeRequest & {
      customer: Pick<Customer, 'id' | 'name' | 'email' | 'cpf' | 'cnpj' | 'kycLevel'>;
    };

    return {
      data: requests.map((req: RequestWithCustomer) => ({
        id: req.id,
        customerId: req.customerId,
        customerName: req.customer.name,
        customerEmail: req.customer.email,
        currentLevel: req.currentLevel,
        targetLevel: req.targetLevel,
        status: req.status,
        documents: req.documents,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      })),
    };
  }

  async getRequestDetails(requestId: string) {
    const request = await this.prisma.kycUpgradeRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            cpf: true,
            cnpj: true,
            kycLevel: true,
            type: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    return {
      data: {
        id: request.id,
        customerId: request.customerId,
        customerName: request.customer.name,
        customerEmail: request.customer.email,
        customerDocument: request.customer.cpf || request.customer.cnpj,
        customerType: request.customer.type,
        currentLevel: request.currentLevel,
        targetLevel: request.targetLevel,
        status: request.status,
        documents: request.documents,
        adminNotes: request.adminNotes,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    };
  }

  async approveRequest(requestId: string, adminEmail: string) {
    const request = await this.prisma.kycUpgradeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Solicitação já foi ${request.status === 'APPROVED' ? 'aprovada' : 'rejeitada'}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.kycUpgradeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminEmail,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.customer.update({
        where: { id: request.customerId },
        data: {
          kycLevel: request.targetLevel,
        },
      }),
    ]);

    return {
      success: true,
      message: 'Upgrade aprovado',
    };
  }

  async rejectRequest(requestId: string, adminEmail: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Motivo da rejeição é obrigatório');
    }

    const request = await this.prisma.kycUpgradeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Solicitação já foi ${request.status === 'APPROVED' ? 'aprovada' : 'rejeitada'}`,
      );
    }

    await this.prisma.kycUpgradeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        adminNotes: reason,
        reviewedBy: adminEmail,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Solicitação rejeitada',
    };
  }
}
