import { z } from 'zod'
import { MoneySchema, OptionalString, UUIDSchema } from './common'

// ── Base ──────────────────────────────────────────────────────────────────────

const CustomerBase = z.object({
  name:    z.string().min(1, 'اسم العميل مطلوب').max(200),
  phone:   OptionalString(20),
  email:   z.string().email('بريد إلكتروني غير صالح').optional().nullable().or(z.literal('')).transform(v => v || null),
  address: OptionalString(500),
  notes:   OptionalString(1000),
  type:    z.enum(['customer', 'supplier', 'both']).default('customer'),
})

// ── CRUD schemas ──────────────────────────────────────────────────────────────

export const CreateCustomerSchema = CustomerBase
export const UpdateCustomerSchema = CustomerBase.partial()
export const CustomerIdParamSchema = z.object({ id: UUIDSchema })

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>

// ── Debt payment ──────────────────────────────────────────────────────────────

export const RecordPaymentSchema = z.object({
  amount:  MoneySchema.refine(v => v > 0, 'المبلغ يجب أن يكون أكبر من صفر'),
  method:  z.enum(['cash', 'card', 'transfer', 'wallet']).default('cash'),
  notes:   OptionalString(500),
})
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>

// ── Response DTO ──────────────────────────────────────────────────────────────

export const CustomerResponseSchema = CustomerBase.extend({
  id:          z.string(),
  company_id:  z.string(),
  balance:     z.number(),
  is_active:   z.boolean(),
  is_deleted:  z.boolean(),
  created_at:  z.string(),
})
export type CustomerResponse = z.infer<typeof CustomerResponseSchema>
