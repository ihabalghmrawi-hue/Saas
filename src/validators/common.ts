import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const UUIDSchema = z.string().uuid('معرّف غير صالح')

export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'تنسيق التاريخ يجب أن يكون YYYY-MM-DD')

export const ISODateTimeSchema = z.string().datetime({ message: 'تنسيق التاريخ والوقت غير صالح' })

export const NonEmptyString = (max = 255) =>
  z.string().min(1, 'هذا الحقل مطلوب').max(max)

export const OptionalString = (max = 255) =>
  z.string().max(max).optional().nullable()

// ── Pagination ────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type Pagination = z.infer<typeof PaginationSchema>

export const SearchSchema = z.object({
  search: z.string().max(100).optional(),
})
export type SearchQuery = z.infer<typeof SearchSchema>

export const DateRangeSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
})
export type DateRange = z.infer<typeof DateRangeSchema>

// Combines pagination + search + date range for list endpoints
export const ListQuerySchema = PaginationSchema.merge(SearchSchema).merge(DateRangeSchema)
export type ListQuery = z.infer<typeof ListQuerySchema>

// ── Shared response shapes ────────────────────────────────────────────────────

export const PagedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data:       z.array(itemSchema),
    total:      z.number(),
    page:       z.number(),
    limit:      z.number(),
    totalPages: z.number(),
  })

export interface PagedResponse<T> {
  data:       T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

// ── Money ─────────────────────────────────────────────────────────────────────

export const MoneySchema = z.number().nonnegative('المبلغ يجب أن يكون موجبًا')

export const PercentSchema = z.number().min(0).max(100)
