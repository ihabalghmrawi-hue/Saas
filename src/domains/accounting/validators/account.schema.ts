import { z } from 'zod'

const AccountTypeEnum = z.enum(['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'])
const NormalBalanceEnum = z.enum(['debit', 'credit'])
const AccountLevelEnum = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

export const CreateAccountSchema = z.object({
  code: z.string().min(2).max(20).regex(/^\d+$/, 'رمز الحساب يجب أن يكون أرقاماً فقط'),
  name: z.string().min(1).max(200),
  name_ar: z.string().min(1).max(200),
  type: AccountTypeEnum,
  subtype: z.string().max(100).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  level: AccountLevelEnum,
  normal_balance: NormalBalanceEnum,
  is_postable: z.boolean().optional().default(true),
  is_header: z.boolean().optional().default(false),
  opening_balance: z.number().min(0).optional().default(0),
  account_group: z.string().max(100).optional(),
  is_receivable: z.boolean().optional().default(false),
  is_payable: z.boolean().optional().default(false),
  currency: z.string().length(3).optional().default('SAR'),
  tax_rate: z.number().min(0).max(100).optional().default(0),
  description: z.string().max(500).optional(),
})

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  name_ar: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  is_postable: z.boolean().optional(),
  is_header: z.boolean().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  account_group: z.string().max(100).nullable().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  opening_balance: z.number().min(0).optional(),
})

export const AccountQuerySchema = z.object({
  type: AccountTypeEnum.optional(),
  level: z.coerce.number().int().min(1).max(4).optional(),
  is_active: z.coerce.boolean().optional(),
  is_postable: z.coerce.boolean().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  search: z.string().max(100).optional(),
  include_children: z.coerce.boolean().optional().default(false),
  include_balance: z.coerce.boolean().optional().default(true),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
})

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>
export type AccountQuery = z.infer<typeof AccountQuerySchema>
