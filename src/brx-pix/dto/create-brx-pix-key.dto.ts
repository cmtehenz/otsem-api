// src/brx-pix/dto/create-brx-pix-key.dto.ts
import { IsIn, IsOptional, IsString } from "class-validator";

/**
 * A doc aceita KeyType como códigos 1..5.
 * Vamos aceitar também nomes e mapear internamente:
 * 1→cpf, 2→cnpj, 3→phone, 4→email, 5→random
 */
export class CreateBrxPixKeyDto {
    @IsString()
    @IsIn(["1", "2", "3", "4", "5", "cpf", "cnpj", "phone", "email", "random"])
    KeyType!: string;

    /**
     * NÃO enviar quando KeyType === "5" | "random"
     */
    @IsOptional()
    @IsString()
    PixKey?: string;
}
