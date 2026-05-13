import type { AccountLevel, AccountType, NormalBalance } from '../types'

export interface AccountEntity extends Record<string, unknown> {
  id: string
  company_id: string
  code: string
  name: string
  name_ar: string
  type: AccountType
  subtype?: string | null
  parent_id?: string | null
  level: AccountLevel
  is_postable: boolean
  is_header: boolean
  normal_balance: NormalBalance
  current_balance: number
  opening_balance: number
  account_group?: string | null
  is_active: boolean
  is_system?: boolean | null
  is_receivable: boolean
  is_payable: boolean
  currency: string
  tax_rate: number
  description?: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  children?: AccountEntity[]
}

export interface AccountTree extends AccountEntity {
  children: AccountTree[]
}

export interface CreateAccountInput {
  code: string
  name: string
  name_ar: string
  type: AccountType
  subtype?: string
  parent_id?: string | null
  level: AccountLevel
  normal_balance: NormalBalance
  is_postable?: boolean
  is_header?: boolean
  opening_balance?: number
  account_group?: string
  is_receivable?: boolean
  is_payable?: boolean
  currency?: string
  tax_rate?: number
  description?: string
}

export interface UpdateAccountInput {
  name?: string
  name_ar?: string
  is_active?: boolean
  is_postable?: boolean
  is_header?: boolean
  parent_id?: string | null
  description?: string
  account_group?: string
  tax_rate?: number
  opening_balance?: number
}

export interface AccountBalance {
  account_id: string
  account_code: string
  account_name: string
  account_name_ar: string
  type: AccountType
  normal_balance: NormalBalance
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
  balance: number
}

export interface DailyBalance {
  id: string
  company_id: string
  account_id: string
  as_of_date: string
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
  net_movement: number
  balance: number
  currency: string
}
