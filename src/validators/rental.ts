import { z } from 'zod'
import { DateSchema, MoneySchema, OptionalString, UUIDSchema } from './common'

// ── Dress ─────────────────────────────────────────────────────────────────────

export const DressStatusSchema = z.enum(['available', 'booked', 'retired'])
export type DressStatus = z.infer<typeof DressStatusSchema>

const DressBase = z.object({
  name:         z.string().min(1, 'اسم الفستان مطلوب').max(200),
  code:         OptionalString(50),
  color:        OptionalString(50),
  size:         OptionalString(20),
  purchase_price: MoneySchema.default(0),
  notes:        OptionalString(500),
  image_url:    z.string().url().optional().nullable(),
})
export const CreateDressSchema    = DressBase
export const UpdateDressSchema    = DressBase.partial()
export type CreateDressInput      = z.infer<typeof CreateDressSchema>
export type UpdateDressInput      = z.infer<typeof UpdateDressSchema>

// ── Rental order ──────────────────────────────────────────────────────────────

export const CreateRentalOrderSchema = z
  .object({
    dress_id:    UUIDSchema,
    customer_id: UUIDSchema.optional().nullable(),
    start_date:  DateSchema,
    end_date:    DateSchema,
    total_price: MoneySchema,
    deposit:     MoneySchema.default(0),
    notes:       OptionalString(500),
  })
  .refine(d => d.end_date > d.start_date, {
    message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية',
    path:    ['end_date'],
  })
export type CreateRentalOrderInput = z.infer<typeof CreateRentalOrderSchema>

export const UpdateRentalOrderSchema = CreateRentalOrderSchema.innerType().partial()
export type UpdateRentalOrderInput = z.infer<typeof UpdateRentalOrderSchema>

// ── Return ────────────────────────────────────────────────────────────────────

export const ReturnDressSchema = z.object({
  condition:      z.enum(['good', 'damaged', 'lost']).default('good'),
  extra_fees:     MoneySchema.default(0),
  deposit_refund: MoneySchema.default(0),
  notes:          OptionalString(500),
})
export type ReturnDressInput = z.infer<typeof ReturnDressSchema>

// ── Pricing rule ──────────────────────────────────────────────────────────────

export const CreatePricingRuleSchema = z.object({
  name:          z.string().min(1).max(100),
  days_min:      z.number().int().min(1),
  days_max:      z.number().int().min(1),
  price_per_day: MoneySchema,
  flat_price:    MoneySchema.optional().nullable(),
  notes:         OptionalString(500),
})
export type CreatePricingRuleInput = z.infer<typeof CreatePricingRuleSchema>

export const UpdatePricingRuleSchema = CreatePricingRuleSchema.partial()
export type UpdatePricingRuleInput = z.infer<typeof UpdatePricingRuleSchema>

// ── Availability check ────────────────────────────────────────────────────────

export const AvailabilityQuerySchema = z.object({
  start:   DateSchema,
  end:     DateSchema,
  exclude: z.string().optional(),
})
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>

// ── Price calculation ─────────────────────────────────────────────────────────

export const CalculatePriceSchema = z.object({
  dress_id:   UUIDSchema,
  start_date: DateSchema,
  end_date:   DateSchema,
})
export type CalculatePriceInput = z.infer<typeof CalculatePriceSchema>
