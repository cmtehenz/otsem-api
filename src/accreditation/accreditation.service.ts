import {
    Injectable,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { BrxAuthService } from '../brx/brx-auth.service';
import { AccreditationPersonDto } from './dto/accreditation-person.dto';
import { AccreditationCompanyDto } from './dto/accreditation-company.dto';
import { AccreditationResult } from './dto/common.dto';
import {
    AccreditationPFResponseData,
    AccreditationPJResponseData,
} from './types/accreditation.types';
import { AccountStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

type BrxResponse<T> = {
    StatusCode: number;
    Title: string;
    Type: string;
    Extensions?: {
        Data?: T;
        Message?: string;
    };
};

@Injectable()
export class AccreditationService {
    private readonly baseUrl =
        process.env.BRX_BASE_URL ?? 'https://apisbank.brxbank.com.br';
    private readonly logger = new Logger(AccreditationService.name);

    constructor(
        private readonly http: HttpService,
        private readonly brxAuth: BrxAuthService,
        private readonly prisma: PrismaService,
    ) { }

    // -------- utils --------
    private mask(value?: string): string {
        if (!value) return '';
        const v = value.replace(/\D/g, '');
        if (v.length === 11) return v.slice(0, 3) + '***' + v.slice(-2);
        if (v.length === 14) return v.slice(0, 4) + '*****' + v.slice(-3);
        return v.slice(0, 3) + '***';
    }

    private async callBrxGet<T>(url: string, token: string, attempt = 1, maxAttempts = 3): Promise<BrxResponse<T>> {
        const correlation = randomUUID();
        const started = performance.now();
        this.logger.debug(`[BRX][GET][${attempt}] ${url} correlation=${correlation}`);
        try {
            const { data } = await firstValueFrom(
                this.http.get<BrxResponse<T>>(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'x-correlation-id': correlation,
                    },
                    timeout: 10000,
                }),
            );
            const ms = Math.round(performance.now() - started);
            this.logger.log(`[BRX][GET][OK] ${url} status=${data.StatusCode} ms=${ms} correlation=${correlation}`);
            return data;
        } catch (e: any) {
            const ms = Math.round(performance.now() - started);
            const status = e?.response?.status;
            const retriable = status && status >= 500;
            this.logger.error(`[BRX][GET][ERR] ${url} status=${status ?? 'N/A'} ms=${ms} attempt=${attempt}/${maxAttempts}`);
            if (retriable && attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, attempt * 300));
                return this.callBrxGet<T>(url, token, attempt + 1, maxAttempts);
            }
            throw e;
        }
    }

    private async callBrxPost<TReq, TRes>(url: string, body: TReq, token: string, attempt = 1, maxAttempts = 3): Promise<BrxResponse<TRes>> {
        const correlation = randomUUID();
        const started = performance.now();
        this.logger.debug(`[BRX][POST][${attempt}] ${url} correlation=${correlation} bodyBytes=${Buffer.byteLength(JSON.stringify(body))}`);
        try {
            const { data } = await firstValueFrom(
                this.http.post<BrxResponse<TRes>>(url, body, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-correlation-id': correlation,
                    },
                    timeout: 12000,
                }),
            );
            const ms = Math.round(performance.now() - started);
            if (data.StatusCode >= 400) {
                this.logger.warn(`[BRX][POST][WARN] ${url} status=${data.StatusCode} ms=${ms} correlation=${correlation} title=${data.Title}`);
            } else {
                this.logger.log(`[BRX][POST][OK] ${url} status=${data.StatusCode} ms=${ms} correlation=${correlation}`);
            }
            return data;
        } catch (e: any) {
            const ms = Math.round(performance.now() - started);
            const status = e?.response?.status;
            const retriable = status && status >= 500;
            this.logger.error(`[BRX][POST][ERR] ${url} status=${status ?? 'N/A'} ms=${ms} attempt=${attempt}/${maxAttempts}`);
            if (retriable && attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, attempt * 400));
                return this.callBrxPost<TReq, TRes>(url, body, token, attempt + 1, maxAttempts);
            }
            throw e;
        }
    }

    private normalizePixLimits(src: any | undefined) {
        if (!src) return undefined;
        return {
            singleTransfer: src.SingleTransfer,
            daytime: src.Daytime ?? src.DayTime ?? 0,
            nighttime: src.Nighttime ?? src.NightTime ?? 0,
            monthly: src.Monthly,
        };
    }

    // -------- PF --------
    async accreditPerson(dto: AccreditationPersonDto): Promise<AccreditationResult> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/accreditate/person`;

        const body = {
            Identifier: dto.identifier,
            ProductId: dto.productId,
            Person: {
                Name: dto.name.trim(),
                SocialName: dto.socialName ?? '',
                Cpf: dto.cpf.replace(/\D/g, ''),
                Birthday: dto.birthday,
                Phone: dto.phone.replace(/\D/g, ''),
                Email: dto.email.toLowerCase(),
                GenderId: dto.genderId ?? undefined,
                Address: {
                    ZipCode: dto.address.zipCode.replace(/\D/g, ''),
                    Street: dto.address.street,
                    Number: dto.address.number ?? '',
                    Complement: dto.address.complement ?? '',
                    Neighborhood: dto.address.neighborhood,
                    CityIbgeCode: dto.address.cityIbgeCode,
                },
            },
            PixLimits: {
                SingleTransfer: dto.pixLimits.singleTransfer,
                Daytime: dto.pixLimits.daytime,
                Nighttime: dto.pixLimits.nighttime,
                Monthly: dto.pixLimits.monthly,
                ServiceId: dto.pixLimits.serviceId,
            },
        };

        this.logger.log(`Credenciar PF identifier=${dto.identifier} cpf=${this.mask(dto.cpf)}`);

        try {
            const data = await this.callBrxPost<typeof body, AccreditationPFResponseData>(url, body, token);
            const d = data.Extensions?.Data;
            if (!d) throw new BadRequestException('Resposta inválida (PF).');

            const customer = await this.prisma.customer.findFirst({ where: { cpf: d.Person.Cpf } });
            if (customer) {
                await this.prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        externalClientId: d.ClientId,
                        externalAccredId: d.AccreditationId,
                        accountStatus: AccountStatus.in_review,
                    },
                });
                this.logger.log(`Customer atualizado id=${customer.id} externalAccredId=${d.AccreditationId}`);
            } else {
                this.logger.warn(`Customer local não encontrado cpf=${this.mask(d.Person.Cpf)}`);
            }

            return {
                accreditationId: d.AccreditationId,
                clientId: d.ClientId,
                accreditationStatus: d.AccreditationStatus,
                accreditationStatusId: d.AccreditationStatusId,
                product: d.Product,
                productId: d.ProductId,
                person: {
                    name: d.Person.Name,
                    socialName: d.Person.SocialName ?? null,
                    cpf: d.Person.Cpf,
                    birthday: d.Person.Birthday,
                    phone: d.Person.Phone,
                    email: d.Person.Email,
                    genderId: d.Person.GenderId ?? null,
                    address: {
                        zipCode: d.Person.Address.ZipCode,
                        street: d.Person.Address.Street,
                        number: d.Person.Address.Number ?? null,
                        complement: d.Person.Address.Complement ?? null,
                        neighborhood: d.Person.Address.Neighborhood,
                        cityIbgeCode: d.Person.Address.CityIbgeCode,
                    },
                },
                pixLimits: this.normalizePixLimits(d.PixLimits),
                message: data.Extensions?.Message,
            };
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message ??
                e?.response?.data?.message ??
                e?.message ??
                'Erro ao credenciar PF.';
            this.logger.error(`Credenciamento PF falhou identifier=${dto.identifier} cpf=${this.mask(dto.cpf)} msg=${msg}`);
            throw new BadRequestException(msg);
        }
    }

    // -------- PJ --------
    async accreditCompany(dto: AccreditationCompanyDto): Promise<AccreditationResult> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/accreditate/company`;

        const body = {
            Identifier: dto.identifier,
            ProductId: dto.productId,
            Company: {
                LegalName: dto.legalName.trim(),
                TradeName: dto.tradeName.trim(),
                Cnpj: dto.cnpj.replace(/\D/g, ''),
                Phone: dto.phone.replace(/\D/g, ''),
                Email: dto.email.toLowerCase(),
                Address: {
                    ZipCode: dto.address.zipCode.replace(/\D/g, ''),
                    Street: dto.address.street,
                    Number: dto.address.number ?? '',
                    Complement: dto.address.complement ?? '',
                    Neighborhood: dto.address.neighborhood,
                    CityIbgeCode: dto.address.cityIbgeCode,
                },
                OwnershipStructure: dto.ownershipStructure.map(o => ({
                    Name: o.name.trim(),
                    Cpf: o.cpf.replace(/\D/g, ''),
                    Birthday: o.birthday,
                    IsAdministrator: o.isAdministrator ? 1 : 0,
                })),
            },
            PixLimits: {
                SingleTransfer: dto.pixLimits.singleTransfer,
                Daytime: dto.pixLimits.daytime,
                Nighttime: dto.pixLimits.nighttime,
                Monthly: dto.pixLimits.monthly,
                ServiceId: dto.pixLimits.serviceId,
            },
        };

        this.logger.log(`Credenciar PJ identifier=${dto.identifier} cnpj=${this.mask(dto.cnpj)}`);

        try {
            const data = await this.callBrxPost<typeof body, AccreditationPJResponseData>(url, body, token);
            const d = data.Extensions?.Data;
            if (!d) throw new BadRequestException('Resposta inválida (PJ).');

            const customer = await this.prisma.customer.findFirst({ where: { cnpj: d.Company.Cnpj } });
            if (customer) {
                await this.prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        externalClientId: d.ClientId,
                        externalAccredId: d.AccreditationId,
                        accountStatus: AccountStatus.in_review,
                    },
                });
                this.logger.log(`Customer atualizado id=${customer.id} externalAccredId=${d.AccreditationId}`);
            } else {
                this.logger.warn(`Customer local não encontrado cnpj=${this.mask(d.Company.Cnpj)}`);
            }

            return {
                accreditationId: d.AccreditationId,
                clientId: d.ClientId,
                accreditationStatus: d.AccreditationStatus,
                accreditationStatusId: d.AccreditationStatusId,
                product: d.Product,
                productId: d.ProductId,
                company: {
                    legalName: d.Company.LegalName,
                    tradeName: d.Company.TradeName,
                    cnpj: d.Company.Cnpj,
                    phone: d.Company.Phone,
                    email: d.Company.Email,
                    address: {
                        zipCode: d.Company.Address.ZipCode,
                        street: d.Company.Address.Street,
                        number: d.Company.Address.Number ?? null,
                        complement: d.Company.Address.Complement ?? null,
                        neighborhood: d.Company.Address.Neighborhood,
                        cityIbgeCode: d.Company.Address.CityIbgeCode,
                    },
                    ownershipStructure: (d.Company.OwnershipStructure ?? []).map(o => ({
                        name: o.Name,
                        cpf: o.Cpf,
                        birthday: o.Birthday,
                        isAdministrator: Boolean(o.IsAdministrator),
                    })),
                },
                pixLimits: this.normalizePixLimits(d.PixLimits),
                message: data.Extensions?.Message,
            };
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message ??
                e?.response?.data?.message ??
                e?.message ??
                'Erro ao credenciar PJ.';
            this.logger.error(`Credenciamento PJ falhou identifier=${dto.identifier} cnpj=${this.mask(dto.cnpj)} msg=${msg}`);
            throw new BadRequestException(msg);
        }
    }

    // -------- consultas diretas BRX --------
    async getAccreditationById(accreditationId: string) {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/${accreditationId}`;
        this.logger.debug(`Consultar credenciamento id=${accreditationId}`);
        try {
            const data = await this.callBrxGet<AccreditationPFResponseData | AccreditationPJResponseData>(url, token);
            if (data.StatusCode >= 400) throw new BadRequestException(data.Extensions?.Message || data.Title);
            return data.Extensions?.Data ?? null;
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message ?? e?.message ?? 'Erro consulta ID.';
            this.logger.error(`Falha consulta ID=${accreditationId} msg=${msg}`);
            throw new BadRequestException(msg);
        }
    }

    async getAccreditationByCpfDirect(cpf: string) {
        const clean = cpf.replace(/\D/g, '');
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/cpf/${clean}`;
        this.logger.debug(`Consultar direto CPF=${this.mask(clean)}`);
        try {
            const data = await this.callBrxGet<AccreditationPFResponseData>(url, token);
            if (data.StatusCode >= 400) throw new BadRequestException(data.Extensions?.Message || data.Title);
            return data.Extensions?.Data ?? null;
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message ?? e?.message ?? 'Erro consulta CPF.';
            this.logger.error(`Falha consulta CPF=${this.mask(clean)} msg=${msg}`);
            throw new BadRequestException(msg);
        }
    }

    async getAccreditationByCnpjDirect(cnpj: string) {
        const clean = cnpj.replace(/\D/g, '');
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/cnpj/${clean}`;
        this.logger.debug(`Consultar direto CNPJ=${this.mask(clean)}`);
        try {
            const data = await this.callBrxGet<AccreditationPJResponseData>(url, token);
            if (data.StatusCode >= 400) throw new BadRequestException(data.Extensions?.Message || data.Title);
            return data.Extensions?.Data ?? null;
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message ?? e?.message ?? 'Erro consulta CNPJ.';
            this.logger.error(`Falha consulta CNPJ=${this.mask(clean)} msg=${msg}`);
            throw new BadRequestException(msg);
        }
    }

    // -------- consultas via base local + BRX --------
    async findCustomerByCpf(cpf: string) {
        const clean = cpf.replace(/\D/g, '');
        const customer = await this.prisma.customer.findFirst({ where: { cpf: clean } });
        if (!customer) throw new BadRequestException('Customer não encontrado (CPF).');
        if (!customer.externalAccredId) throw new BadRequestException('Customer sem credenciamento.');
        this.logger.debug(`Lookup local + BRX CPF=${this.mask(clean)} accredId=${customer.externalAccredId}`);
        return this.getAccreditationById(customer.externalAccredId);
    }

    async findCustomerByCnpj(cnpj: string) {
        const clean = cnpj.replace(/\D/g, '');
        const customer = await this.prisma.customer.findFirst({ where: { cnpj: clean } });
        if (!customer) throw new BadRequestException('Customer não encontrado (CNPJ).');
        if (!customer.externalAccredId) throw new BadRequestException('Customer sem credenciamento.');
        this.logger.debug(`Lookup local + BRX CNPJ=${this.mask(clean)} accredId=${customer.externalAccredId}`);
        return this.getAccreditationById(customer.externalAccredId);
    }
}
