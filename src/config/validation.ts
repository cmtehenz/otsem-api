// src/config/validation.ts (exemplo)
import { plainToInstance } from 'class-transformer';
import { IsUrl, IsOptional, IsString } from 'class-validator';

class EnvSchema {
    @IsUrl()
    BRX_API_BASEL!: string;

    @IsOptional()
    @IsString()
    BRX_TOKEN?: string;
}

export function validate(config: Record<string, unknown>) {
    const validated = plainToInstance(EnvSchema, config, { enableImplicitConversion: true });
    // ... use class-validator para lançar erro se faltar
    return validated;
}
