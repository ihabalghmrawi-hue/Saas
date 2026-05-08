import { z } from 'zod'
import { MoneySchema, OptionalString, PercentSchema, UUIDSchema } from './common'

// ── Line item ─────────────────────────────────────────────────────────────────

export const SaleItemSchema = z.object({
  product_id:   UUIDSchema,
  quantity:     z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unit_price:   MoneySchema,
  discount_pct: PercentSchema.default(0),
  total:        MoneySchema,
})
export type SaleItem = z.infer<typeof SaleItemSchema>

// ── Create sale (POS) ─────────────────────────────────────────────────────────

export const CreateSaleSchema = z
  .object({
    company_id:      UUIDSchema,
    warehouse_id:    UUIDSchema.optional().nullable(),
    customer_id:     UUIDSchema.optional().nullable(),
    items:           z.array(SaleItemSchema).min(1, 'الفاتورة يجب أن تحتوي على عنصر واحد على الأقل'),
    subtotal:        MoneySchema,
    discount_percent: PercentSchema.default(0),
    discount_amount: MoneySchema.default(0),
    tax_amount:      MoneySchema.default(0),
    total:           MoneySchema,
    paid_amount:     MoneySchema,
    payment_method:  z.enum(['cash', 'card', 'transfer', 'wallet']).default('cash'),
    notes:           OptionalString(500),
  })
  .refine(d => d.paid_amount <= d.total + 0.01, {
    message: 'المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي',
    path:    ['paid_amount'],
  })

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>

// ── Return / refund ───────────────────────────────────────────────────────────

export const ReturnItemSchema = z.object({
  sale_item_id: UUIDSchema,
  quantity:     z.number().positive(),
  unit_price:   MoneySchema,
  total:        MoneySchema,
})
export type ReturnItem = z.infer<typeof ReturnItemSchema>

export const CreateReturnSchema = z.object({
  sale_id:       UUIDSchema,
  items:         z.array(ReturnItemSchema).min(1),
  refund_method: z.enum(['cash', 'card', 'transfer', 'wallet', 'store_credit']).default('cash'),
  reason:        OptionalString(500),
  notes:         OptionalString(500),
  warehouse_id:  UUIDSchema.optional().nullable(),
})
export type CreateReturnInput = z.infer<typeof CreateReturnSchema>

// ── Response DTO ──────────────────────────────────────────────────────────────

export const SaleResponseSchema = z.object({
  id:             z.string(),
  invoice_number: z.string(),
  company_id:     z.string(),
  customer_id:    z.string().nullable(),
  subtotal:       z.number(),
  total:          z.number(),
  paid_amount:    z.number(),
  due_amount:     z.number(),
  status:         z.string(),
  payment_method: z.string(),
  created_at:     z.string(),
})
export type SaleResponse = z.infer<typeof SaleResponseSchema>
