import { IsNumber, IsPositive, IsString, IsIn, Length } from 'class-validator';

export class CreateCashOutDto {
    @IsString() walletId: string;
    @IsNumber() @IsPositive() amount: number;

    @IsString() pixKey: string;
    @IsString() @IsIn(['CPF', 'CNPJ', 'EMAIL', 'CELULAR', 'CHAVE_ALEATORIA'])
    pixKeyType: string;

    @IsString() @Length(2, 120) beneficiaryName: string;
    @IsString() beneficiaryTaxNumber: string;

    @IsString() requestId: string; // idempotência do cliente
}
