// src/pix/utils/keytype.ts
export type InputKeyType =
    | "1" | "2" | "3" | "4" | "5"
    | "cpf" | "cnpj" | "phone" | "email" | "random";

/** Converte entrada flexível para os códigos exigidos pela BRX ("1"…"5"). */
export function mapKeyTypeToApi(keyType: string): "1" | "2" | "3" | "4" | "5" {
    const t = String(keyType).trim().toLowerCase();

    if (t === "1" || t === "cpf") return "1";
    if (t === "2" || t === "cnpj") return "2";
    if (t === "3" || t === "phone") return "3";
    if (t === "4" || t === "email") return "4";
    if (t === "5" || t === "random") return "5";

    // fallback extra (aceita "aleatoria" ou "aleatória" se alguém mandar)
    if (t === "aleatoria" || t === "aleatória") return "5";

    throw new Error("Tipo de chave inválido (use 1..5 ou cpf/cnpj/phone/email/random).");
}
