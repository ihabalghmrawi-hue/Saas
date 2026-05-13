import type { ReconciliationStatus } from '../types'

export interface ReconciliationEntity extends Record<string, unknown> {
  id: string
  company_id: string
  account_id: string
  reference_type: string
  reference_id?: string | null
  reference_number?: string | null
  statement_date: string
  statement_amount: number
  cleared_amount: number
  difference: number
  status: ReconciliationStatus
  notes?: string | null
  reconciled_at?: string | null
  reconciled_by?: string | null
  created_at: string
  updated_at: string
  lines?: ReconciliationLineEntity[]
}

export interface ReconciliationLineEntity {
  id: string
  reconciliation_id: string
  journal_entry_id?: string | null
  invoice_id?: string | null
  payment_id?: string | null
  amount: number
  matched_amount: number
  difference: number
  status: 'partial' | 'matched'
  notes?: string | null
  created_at: string
}

export interface CreateReconciliationInput {
  account_id: string
  reference_type: string
  reference_id?: string
  reference_number?: string
  statement_date: string
  statement_amount: number
  notes?: string
}

export interface AgedItem {
  account_id: string
  company_id: string
  code: string
  account_name: string
  invoice_date: string
  journal_entry_id: string
  entry_number: string
  reference: string
  amount: number
  days_overdue: number
  aging_bucket: string
}

export interface AgedReport {
  total: number
  buckets: {
    '0-30': { total: number; items: AgedItem[] }
    '31-60': { total: number; items: AgedItem[] }
    '61-90': { total: number; items: AgedItem[] }
    '90+': { total: number; items: AgedItem[] }
  }
}

export interface CustomerBalance {
  account_id: string
  account_name: string
  account_name_ar: string
  total_debit: number
  total_credit: number
  balance: number
  last_transaction_date: string | null
}
