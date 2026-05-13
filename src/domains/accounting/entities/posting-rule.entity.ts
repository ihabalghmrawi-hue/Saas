import type { AccountingEventType } from '../types'

export interface PostingRuleEntity extends Record<string, unknown> {
  id: string
  company_id: string
  name: string
  name_ar?: string | null
  event_type: AccountingEventType
  description?: string | null
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
  lines?: PostingRuleLineEntity[]
}

export interface UpdatePostingRuleInput {
  name?: string
  name_ar?: string
  description?: string | null
  is_active?: boolean
  priority?: number
  lines?: CreatePostingRuleLineInput[]
}

export interface PostingRuleLineEntity {
  id: string
  posting_rule_id: string
  sequence: number
  debit_account_id?: string | null
  credit_account_id?: string | null
  condition_field?: string | null
  condition_operator?: string | null
  condition_value?: string | null
  amount_percent: number
  amount_fixed: number
  description?: string | null
  created_at: string
}

export interface AccountMappingEntity extends Record<string, unknown> {
  id: string
  company_id: string
  event_type: AccountingEventType
  debit_account_id: string
  credit_account_id: string
  tax_account_id?: string | null
  tax_rate: number
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreatePostingRuleInput {
  name: string
  name_ar?: string
  event_type: AccountingEventType
  description?: string
  is_active?: boolean
  priority?: number
  lines: CreatePostingRuleLineInput[]
}

export interface CreatePostingRuleLineInput {
  sequence: number
  debit_account_id?: string
  credit_account_id?: string
  condition_field?: string
  condition_operator?: string
  condition_value?: string
  amount_percent?: number
  amount_fixed?: number
  description?: string
}

export interface CreateAccountMappingInput {
  event_type: AccountingEventType
  debit_account_id: string
  credit_account_id: string
  tax_account_id?: string
  tax_rate?: number
  description?: string
}
