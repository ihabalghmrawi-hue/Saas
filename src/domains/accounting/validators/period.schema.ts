import { z } from 'zod'

export const CreateFiscalYearSchema = z.object({
  name: z.string().min(1).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'),
  is_current: z.boolean().optional().default(false),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'تاريخ نهاية السنة المالية يجب أن يكون بعد تاريخ البداية' }
)

export const CreatePeriodSchema = z.object({
  fiscal_year_id: z.string().uuid(),
  period_number: z.number().int().min(1).max(12),
  name: z.string().min(1).max(100),
  name_ar: z.string().max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  { message: 'تاريخ نهاية الفترة يجب أن يكون بعد أو يساوي تاريخ البداية' }
)

export const PeriodActionSchema = z.object({
  action: z.enum(['close', 'open', 'lock', 'unlock']),
  locked_by: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
})

export type CreateFiscalYearInput = z.infer<typeof CreateFiscalYearSchema>
export type CreatePeriodInput = z.infer<typeof CreatePeriodSchema>
export type PeriodAction = z.infer<typeof PeriodActionSchema>
