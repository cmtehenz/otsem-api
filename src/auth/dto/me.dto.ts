// src/auth/dto/me.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class MeDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    email: string;

    @ApiProperty({ required: false, nullable: true })
    name?: string | null;

    @ApiProperty({ required: false, nullable: true })
    role?: string | null;
}
