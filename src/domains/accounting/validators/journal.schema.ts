import { z } from 'zod'

export const CreateJournalLineSchema = z.object({
  account_code: z.string().optional(),
  account_id: z.string().uuid().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string().max(500).optional(),
  cost_center_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
}).refine(
  data => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  { message: 'يجب أن يحتوي السطر على مدين أو دائن فقط، وليس كليهما' }
).refine(
  data => data.debit > 0 || data.credit > 0,
  { message: 'يجب أن يحتوي السطر على مبلغ' }
).refine(
  data => data.account_code || data.account_id,
  { message: 'يجب تحديد الحساب (رمز أو معرف)' }
)

export const CreateJournalEntrySchema = z.object({
  description: z.string().min(1).max(1000),
  description_ar: z.string().max(1000).optional(),
  reference: z.string().max(200).optional(),
  source: z.string().max(50).optional(),
  source_id: z.string().max(100).optional(),
  source_document: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD').optional(),
  fiscal_year_id: z.string().uuid().optional(),
  period_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  cost_center_id: z.string().uuid().nullable().optional(),
  created_by_id: z.string().uuid().optional(),
  currency: z.string().length(3).optional().default('SAR'),
  exchange_rate: z.number().positive().optional().default(1),
  tags: z.array(z.string().max(50)).max(10).optional(),
  lines: z.array(CreateJournalLineSchema)
    .min(2, 'يجب أن يحتوي القيد على سطرين على الأقل')
    .max(100, 'الحد الأقصى 100 سطر لكل قيد'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0)
    return Math.abs(totalDebit - totalCredit) < 0.01
  },
  { message: 'القيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن' }
)

export const JournalQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'approved', 'posted', 'reversed', 'void']).optional(),
  source: z.string().max(50).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_id: z.string().uuid().optional(),
  fiscal_year_id: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  branch_id: z.string().uuid().nullable().optional(),
  cost_center_id: z.string().uuid().nullable().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  sort_by: z.enum(['date', 'entry_number', 'created_at', 'total_debit']).optional().default('date'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const PostJournalActionSchema = z.object({
  action: z.enum(['post', 'reverse', 'void']),
  approved_by_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
})

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntrySchema>
export type JournalQuery = z.infer<typeof JournalQuerySchema>
export type PostJournalAction = z.infer<typeof PostJournalActionSchema>
