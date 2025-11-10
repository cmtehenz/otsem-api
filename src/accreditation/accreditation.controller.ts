import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccreditationService } from './accreditation.service';
import { AccreditationPersonDto } from './dto/accreditation-person.dto';
import { AccreditationCompanyDto } from './dto/accreditation-company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('accreditation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AccreditationController {
    constructor(private readonly service: AccreditationService) { }

    // Credenciar PF
    @Post('person')
    accreditPerson(@Body() dto: AccreditationPersonDto) {
        return this.service.accreditPerson(dto);
    }

    // Credenciar PJ
    @Post('company')
    accreditCompany(@Body() dto: AccreditationCompanyDto) {
        return this.service.accreditCompany(dto);
    }

    // Consultar por AccreditationId (direto BRX)
    @Get('id/:accreditationId')
    getById(@Param('accreditationId') accreditationId: string) {
        return this.service.getAccreditationById(accreditationId);
    }

    // Consulta direta BRX por CPF (somente se credenciado pelo integrador)
    @Get('brx/cpf/:cpf')
    getByCpfDirect(@Param('cpf') cpf: string) {
        return this.service.getAccreditationByCpfDirect(cpf);
    }

    // Consulta direta BRX por CNPJ (somente se credenciado pelo integrador)
    @Get('brx/cnpj/:cnpj')
    getByCnpjDirect(@Param('cnpj') cnpj: string) {
        return this.service.getAccreditationByCnpjDirect(cnpj);
    }

    // Consulta via customer local (CPF) -> usa externalAccredId
    @Get('customer/cpf/:cpf')
    getCustomerCpf(@Param('cpf') cpf: string) {
        return this.service.findCustomerByCpf(cpf);
    }

    // Consulta via customer local (CNPJ) -> usa externalAccredId
    @Get('customer/cnpj/:cnpj')
    getCustomerCnpj(@Param('cnpj') cnpj: string) {
        return this.service.findCustomerByCnpj(cnpj);
    }
}
