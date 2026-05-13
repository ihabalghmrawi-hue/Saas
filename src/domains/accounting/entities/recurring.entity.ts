import type { Frequency } from '../types'

export interface RecurringJournalEntity extends Record<string, unknown> {
  id: string
  company_id: string
  name: string
  name_ar?: string | null
  description?: string | null
  frequency: Frequency
  interval_days?: number | null
  day_of_month?: number | null
  day_of_week?: number | null
  month_of_year?: number | null
  start_date: string
  end_date?: string | null
  next_run_date?: string | null
  last_run_date?: string | null
  total_runs: number
  max_runs?: number | null
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  template_lines: RecurringTemplateLine[]
  is_auto_post: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
  logs?: RecurringJournalLogEntity[]
}

export interface RecurringTemplateLine {
  account_code: string
  debit: number
  credit: number
  description?: string
  cost_center_id?: string
  branch_id?: string
}

export interface RecurringJournalLogEntity {
  id: string
  recurring_journal_id: string
  journal_entry_id?: string | null
  run_date: string
  status: 'success' | 'failed' | 'skipped'
  error_message?: string | null
  created_at: string
}

export interface CreateRecurringJournalInput {
  name: string
  name_ar?: string
  description?: string
  frequency: Frequency
  interval_days?: number
  day_of_month?: number
  day_of_week?: number
  month_of_year?: number
  start_date: string
  end_date?: string
  max_runs?: number
  template_lines: RecurringTemplateLine[]
  is_auto_post?: boolean
}
