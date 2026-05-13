import type { JournalStatus, ApprovalStatus } from '../types'

export interface JournalEntryEntity extends Record<string, unknown> {
  id: string
  company_id: string
  entry_number: string
  date: string
  description: string
  description_ar?: string | null
  reference?: string | null
  source: string
  source_id?: string | null
  source_document?: string | null
  status: JournalStatus
  approval_status: ApprovalStatus
  approved_by_id?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  reversal_reason?: string | null
  is_posted: boolean
  is_balanced: boolean
  auto_generated: boolean
  total_debit: number
  total_credit: number
  fiscal_year_id?: string | null
  period_id?: string | null
  branch_id?: string | null
  cost_center_id?: string | null
  created_by_id?: string | null
  reversal_of?: string | null
  reversal_entry_id?: string | null
  currency: string
  exchange_rate: number
  tags?: string[] | null
  posted_at?: string | null
  created_at: string
  updated_at: string
  lines?: JournalLineEntity[]
}

export interface JournalLineEntity {
  id: string
  journal_entry_id: string
  account_id: string
  account_code?: string
  account_name?: string
  account_name_ar?: string
  debit: number
  credit: number
  description?: string | null
  cost_center_id?: string | null
  branch_id?: string | null
  line_number: number
  created_at: string
}

export interface CreateJournalEntryInput {
  company_id: string
  description: string
  description_ar?: string
  reference?: string
  source?: string
  source_id?: string
  source_document?: string
  date?: string
  fiscal_year_id?: string
  period_id?: string
  branch_id?: string
  cost_center_id?: string
  created_by_id?: string
  currency?: string
  exchange_rate?: number
  tags?: string[]
  lines: CreateJournalLineInput[]
}

export interface CreateJournalLineInput {
  account_code?: string
  account_id?: string
  debit: number
  credit: number
  description?: string
  cost_center_id?: string
  branch_id?: string
}

export interface PostJournalResult {
  journal_id: string
  entry_number: string
  accounts_created?: boolean
}
