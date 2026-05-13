import { z } from 'zod'

const AccountingEventTypeEnum = z.enum([
  'sale_cash', 'sale_credit', 'sale_cogs', 'sale_payment',
  'sale_return_cash', 'sale_return_credit', 'sale_return_cogs',
  'purchase_cash', 'purchase_credit', 'purchase_payment',
  'expense_cash', 'expense_accrual',
  'treasury_transfer', 'rental_revenue',
  'inventory_adjustment', 'construction_expense',
  'customer_payment', 'supplier_payment', 'payroll',
  'manual',
])

export const PostingRuleLineSchema = z.object({
  sequence: z.number().int().min(0),
  debit_account_id: z.string().uuid().nullable().optional(),
  credit_account_id: z.string().uuid().nullable().optional(),
  condition_field: z.string().max(100).nullable().optional(),
  condition_operator: z.string().max(20).nullable().optional(),
  condition_value: z.string().max(200).nullable().optional(),
  amount_percent: z.number().min(0).max(100).optional().default(100),
  amount_fixed: z.number().min(0).optional().default(0),
  description: z.string().max(500).nullable().optional(),
})

export const CreatePostingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  name_ar: z.string().max(200).optional(),
  event_type: AccountingEventTypeEnum,
  description: z.string().max(1000).optional(),
  is_active: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(0),
  lines: z.array(PostingRuleLineSchema).min(1, 'يجب أن تحتوي القاعدة على سطر واحد على الأقل'),
})

export const UpdatePostingRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  name_ar: z.string().max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  lines: z.array(PostingRuleLineSchema).min(1).optional(),
})

export const CreateAccountMappingSchema = z.object({
  event_type: AccountingEventTypeEnum,
  debit_account_id: z.string().uuid(),
  credit_account_id: z.string().uuid(),
  tax_account_id: z.string().uuid().nullable().optional(),
  tax_rate: z.number().min(0).max(100).optional().default(0),
  description: z.string().max(500).nullable().optional(),
})

export type CreatePostingRuleInput = z.infer<typeof CreatePostingRuleSchema>
export type UpdatePostingRuleInput = z.infer<typeof UpdatePostingRuleSchema>
export type CreateAccountMappingInput = z.infer<typeof CreateAccountMappingSchema>
