// src/pix/dtos/create-key.dto.ts
import { IsIn, IsOptional, IsString, ValidateIf } from "class-validator";
import type { InputKeyType } from "../utils/keytype";

export class CreatePixKeyDto {
    @IsString()
    @IsIn(["1", "2", "3", "4", "5", "cpf", "cnpj", "phone", "email", "random"])
    keyType!: InputKeyType;

    /** Obrigatório para tudo, exceto aleatória ("5" | "random") */
    @ValidateIf(o => {
        const t = String(o.keyType).trim().toLowerCase();
        return !(t === "5" || t === "random");
    })
    @IsString()
    @IsOptional()
    pixKey?: string;
}

/** Corpo que a BRX espera */
export interface BrxCreateKeyBody {
    keyType: "cpf" | "cnpj" | "phone" | "email" | "random";
    PixKey?: string; // omitir quando aleatória
}

/** Resposta BRX (tipagem aberta) */
export interface BrxCreateKeyRaw {
    statusCode?: number;
    title?: string;
    type?: string;
    extensions?: {
        data?: unknown;
        message?: string;
        errors?: unknown;
    };
}
