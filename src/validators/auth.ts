import { z } from 'zod'

// ── PIN login (staff) ────────────────────────────────────────────────────────

export const PinLoginSchema = z.object({
  pin: z
    .string()
    .min(4, 'الرقم السري يجب أن يكون 4 أرقام على الأقل')
    .max(8, 'الرقم السري لا يمكن أن يتجاوز 8 أرقام')
    .regex(/^\d+$/, 'الرقم السري يجب أن يحتوي على أرقام فقط'),
})
export type PinLoginInput = z.infer<typeof PinLoginSchema>

export const PinLoginResponseSchema = z.object({
  success: z.literal(true),
  name:    z.string(),
  role:    z.string(),
})
export type PinLoginResponse = z.infer<typeof PinLoginResponseSchema>

// ── Session payload (stored in JWT) ──────────────────────────────────────────

export const SessionPayloadSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  role:        z.string(),
  permissions: z.array(z.string()),
  companyId:   z.string(),
  loginAt:     z.number(),
})
export type SessionPayload = z.infer<typeof SessionPayloadSchema>
