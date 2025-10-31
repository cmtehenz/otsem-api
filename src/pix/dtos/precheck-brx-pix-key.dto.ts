// src/brx-pix/dto/precheck-brx-pix-key.dto.ts
import { IsNumberString, IsOptional } from "class-validator";

export class PrecheckQueryDto {
    @IsOptional()
    @IsNumberString()
    value?: string; // API recebe ?value=10.00
}
