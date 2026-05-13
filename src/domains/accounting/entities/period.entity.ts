import type { FiscalYearStatus, PeriodStatus } from '../types'

export interface FiscalYearEntity extends Record<string, unknown> {
  id: string
  company_id: string
  name: string
  start_date: string
  end_date: string
  status: FiscalYearStatus
  is_current: boolean
  notes?: string | null
  closed_at?: string | null
  closed_by?: string | null
  created_at: string
  updated_at: string
  periods?: AccountingPeriodEntity[]
}

export interface AccountingPeriodEntity {
  id: string
  company_id: string
  fiscal_year_id: string
  period_number: number
  name: string
  name_ar?: string | null
  start_date: string
  end_date: string
  status: PeriodStatus
  locked_at?: string | null
  locked_by?: string | null
  closed_at?: string | null
  closed_by?: string | null
  created_at: string
  updated_at: string
}

export interface CreateFiscalYearInput {
  name: string
  start_date: string
  end_date: string
  is_current?: boolean
  notes?: string
}

export interface CreatePeriodInput {
  fiscal_year_id: string
  period_number: number
  name: string
  name_ar?: string
  start_date: string
  end_date: string
}

export interface PeriodClosingResult {
  period_id: string
  closed: boolean
  next_period_id?: string | null
  entries_posted?: number
  warnings?: string[]
}
