import { z } from 'zod'
import { DateSchema, MoneySchema, OptionalString, UUIDSchema } from './common'

// ── Purchase line item ────────────────────────────────────────────────────────

export const PurchaseItemSchema = z.object({
  product_id: UUIDSchema,
  quantity:   z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unit_cost:  MoneySchema,
  total:      MoneySchema,
})
export type PurchaseItem = z.infer<typeof PurchaseItemSchema>

// ── Create purchase ───────────────────────────────────────────────────────────

export const CreatePurchaseSchema = z.object({
  company_id:     UUIDSchema,
  supplier_id:    UUIDSchema.optional().nullable(),
  warehouse_id:   UUIDSchema.optional().nullable(),
  purchase_date:  DateSchema,
  items:          z.array(PurchaseItemSchema).min(1, 'يجب أن يحتوي الأمر الشرائي على عنصر واحد على الأقل'),
  subtotal:       MoneySchema,
  tax_amount:     MoneySchema.default(0),
  total:          MoneySchema,
  paid_amount:    MoneySchema,
  due_amount:     MoneySchema,
  payment_status: z.enum(['paid', 'partial', 'unpaid']).default('unpaid'),
  notes:          OptionalString(500),
})
export type CreatePurchaseInput = z.infer<typeof CreatePurchaseSchema>

// ── Response DTO ──────────────────────────────────────────────────────────────

export const PurchaseResponseSchema = z.object({
  id:             z.string(),
  company_id:     z.string(),
  supplier_id:    z.string().nullable(),
  subtotal:       z.number(),
  total:          z.number(),
  paid_amount:    z.number(),
  due_amount:     z.number(),
  payment_status: z.string(),
  created_at:     z.string(),
})
export type PurchaseResponse = z.infer<typeof PurchaseResponseSchema>
