import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { CustomerType } from '@prisma/client';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() name?: string;

  // KYC fields
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;
}

export const RegisterDtoSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    name: { type: 'string' },
    type: { type: 'string', enum: ['PF', 'PJ'] },
    cpf: { type: 'string' },
    cnpj: { type: 'string' },
  },
  required: ['email', 'password'],
};
