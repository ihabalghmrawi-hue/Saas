import { z } from 'zod'

export const CreateReconciliationSchema = z.object({
  account_id: z.string().uuid(),
  reference_type: z.string().min(1).max(50),
  reference_id: z.string().max(100).optional(),
  reference_number: z.string().max(200).optional(),
  statement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statement_amount: z.number(),
  notes: z.string().max(1000).optional(),
})

export const ReconciliationQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  status: z.enum(['unmatched', 'partial', 'matched', 'overpaid']).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
})

export const AgedReportQuerySchema = z.object({
  type: z.enum(['receivables', 'payables']).default('receivables'),
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  account_id: z.string().uuid().optional(),
})

export type CreateReconciliationInput = z.infer<typeof CreateReconciliationSchema>
export type AgedReportQuery = z.infer<typeof AgedReportQuerySchema>
