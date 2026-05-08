import { z } from 'zod'
import { MoneySchema, OptionalString, UUIDSchema } from './common'

// ── Base ──────────────────────────────────────────────────────────────────────

const ProductBase = z.object({
  name:          z.string().min(1, 'اسم المنتج مطلوب').max(200),
  sku:           OptionalString(100),
  barcode:       OptionalString(100),
  price:         MoneySchema.default(0),
  cost:          MoneySchema.default(0),
  quantity:      z.number().int().default(0),
  unit_id:       UUIDSchema.optional().nullable(),
  category_id:   UUIDSchema.optional().nullable(),
  warehouse_id:  UUIDSchema.optional().nullable(),
  description:   OptionalString(1000),
  image_url:     z.string().url().optional().nullable(),
  track_stock:   z.boolean().default(true),
  low_stock_alert: z.number().int().min(0).default(5),
})

// ── CRUD schemas ──────────────────────────────────────────────────────────────

export const CreateProductSchema = ProductBase
export const UpdateProductSchema = ProductBase.partial()
export const ProductIdParamSchema = z.object({ id: UUIDSchema })

export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

// ── Response DTO ──────────────────────────────────────────────────────────────

export const ProductResponseSchema = ProductBase.extend({
  id:          z.string(),
  company_id:  z.string(),
  is_deleted:  z.boolean(),
  created_at:  z.string(),
  updated_at:  z.string().optional(),
  // joined relations (optional — depends on select)
  product_categories: z.object({ name: z.string(), color: z.string().nullable() }).optional().nullable(),
  units:              z.object({ name: z.string(), abbreviation: z.string().nullable() }).optional().nullable(),
  inventory:          z.array(z.object({ quantity: z.number(), warehouse_id: z.string() })).optional(),
})
export type ProductResponse = z.infer<typeof ProductResponseSchema>

// ── Inventory adjust ──────────────────────────────────────────────────────────

export const AdjustInventorySchema = z.object({
  warehouse_id: UUIDSchema,
  quantity:     z.number().int(),
  reason:       z.string().max(200).optional(),
})
export type AdjustInventoryInput = z.infer<typeof AdjustInventorySchema>
