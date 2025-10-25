export type BrxEnvelope<T = any> = {
    StatusCode: number
    Title: string
    Type?: string
    Extensions?: {
        Message?: string
        Data?: T
        errors?: string[]
    }
}

export function unwrapBrx<T = any>(res: BrxEnvelope<T>): T {
    if (!res) throw new Error('BRX_EMPTY_RESPONSE')
    if (res.StatusCode && res.StatusCode >= 200 && res.StatusCode < 300) {
        return (res.Extensions?.Data as T) ?? (undefined as any)
    }
    const errs = res.Extensions?.errors?.join('; ')
    const title = res.Title || 'BRX_ERROR'
    const msg = errs || res.Extensions?.Message || title
    const code = res.StatusCode || 500
    const e = new Error(`BRX ${code}: ${msg}`)
        ; (e as any).statusCode = code
    throw e
}
