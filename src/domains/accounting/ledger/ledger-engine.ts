import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import type { ServiceResult } from '../types'

export interface LedgerBalance {
  account_id: string
  account_code: string
  account_name: string
  account_name_ar: string
  account_type: string
  normal_balance: 'debit' | 'credit'
  balance: number
  total_debit: number
  total_credit: number
}

export interface LedgerEntry {
  entry_id: string
  entry_number: string
  entry_date: string
  description: string
  reference: string | null
  source: string
  source_id: string | null
  account_id: string
  account_code: string
  account_name: string
  debit: number
  credit: number
  running_balance: number
  cost_center_id: string | null
  branch_id: string | null
  created_at: string
}

export interface PeriodBalance {
  account_id: string
  account_code: string
  opening_balance: number
  period_debit: number
  period_credit: number
  closing_balance: number
}

export interface TrialBalanceLine {
  account_id: string
  account_code: string
  account_name: string
  account_name_ar: string
  account_type: string
  normal_balance: string
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
  balance: number
}

export class LedgerEngine {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async getAccountBalance(
    accountId: string,
    asOfDate?: string,
  ): Promise<ServiceResult<number>> {
    try {
      const { data, error } = await this.db.rpc('ledger_get_account_balance', {
        p_account_id: accountId,
        p_company_id: this.companyId,
        p_as_of_date: asOfDate || null,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data: Number(data) || 0 }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'BALANCE_FETCH_FAILED' }
    }
  }

  async getAllBalances(asOfDate?: string): Promise<ServiceResult<LedgerBalance[]>> {
    try {
      const { data, error } = await this.db.rpc('ledger_get_all_balances', {
        p_company_id: this.companyId,
        p_as_of_date: asOfDate || null,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return {
        ok: true,
        data: (data ?? []).map((r: any) => ({
          account_id: r.account_id,
          account_code: r.account_code,
          account_name: r.account_name,
          account_name_ar: r.account_name_ar || r.account_name,
          account_type: r.account_type,
          normal_balance: r.normal_balance,
          balance: Number(r.balance) || 0,
          total_debit: Number(r.total_debit) || 0,
          total_credit: Number(r.total_credit) || 0,
        })),
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'BALANCES_FETCH_FAILED' }
    }
  }

  async getGeneralLedger(opts: {
    accountId?: string
    fromDate?: string
    toDate?: string
    costCenterId?: string
    branchId?: string
  }): Promise<ServiceResult<LedgerEntry[]>> {
    try {
      const { data, error } = await this.db.rpc('ledger_get_general_ledger', {
        p_company_id: this.companyId,
        p_account_id: opts.accountId || null,
        p_from_date: opts.fromDate || null,
        p_to_date: opts.toDate || null,
        p_cost_center_id: opts.costCenterId || null,
        p_branch_id: opts.branchId || null,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return {
        ok: true,
        data: (data ?? []).map((r: any) => ({
          entry_id: r.entry_id,
          entry_number: r.entry_number,
          entry_date: r.entry_date,
          description: r.description,
          reference: r.reference,
          source: r.source,
          source_id: r.source_id,
          account_id: r.account_id,
          account_code: r.account_code,
          account_name: r.account_name,
          debit: Number(r.debit) || 0,
          credit: Number(r.credit) || 0,
          running_balance: Number(r.running_balance) || 0,
          cost_center_id: r.cost_center_id,
          branch_id: r.branch_id,
          created_at: r.created_at,
        })),
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LEDGER_FETCH_FAILED' }
    }
  }

  async getPeriodBalances(periodId: string): Promise<ServiceResult<PeriodBalance[]>> {
    try {
      const { data, error } = await this.db.rpc('ledger_get_period_balances', {
        p_company_id: this.companyId,
        p_period_id: periodId,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return {
        ok: true,
        data: (data ?? []).map((r: any) => ({
          account_id: r.account_id,
          account_code: r.account_code,
          opening_balance: Number(r.opening_balance) || 0,
          period_debit: Number(r.period_debit) || 0,
          period_credit: Number(r.period_credit) || 0,
          closing_balance: Number(r.closing_balance) || 0,
        })),
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PERIOD_BALANCES_FETCH_FAILED' }
    }
  }

  async getTrialBalance(fromDate?: string, toDate?: string): Promise<ServiceResult<TrialBalanceLine[]>> {
    try {
      const { data, error } = await this.db.rpc('ledger_get_trial_balance', {
        p_company_id: this.companyId,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return {
        ok: true,
        data: (data ?? []).map((r: any) => ({
          account_id: r.account_id,
          account_code: r.account_code,
          account_name: r.account_name,
          account_name_ar: r.account_name_ar,
          account_type: r.account_type,
          normal_balance: r.normal_balance,
          opening_debit: Number(r.opening_debit) || 0,
          opening_credit: Number(r.opening_credit) || 0,
          period_debit: Number(r.period_debit) || 0,
          period_credit: Number(r.period_credit) || 0,
          closing_debit: Number(r.closing_debit) || 0,
          closing_credit: Number(r.closing_credit) || 0,
          balance: Number(r.balance) || 0,
        })),
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TRIAL_BALANCE_FAILED' }
    }
  }

  async generateDailyBalances(asOfDate?: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await this.db.rpc('ledger_generate_daily_balances', {
        p_company_id: this.companyId,
        p_as_of_date: asOfDate || new Date().toISOString().slice(0, 10),
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'DAILY_BALANCES_FAILED' }
    }
  }

  async createFinancialSnapshot(
    snapshotType: 'daily' | 'monthly' | 'quarterly' | 'yearly' = 'daily',
    asOfDate?: string,
  ): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await this.db.rpc('ledger_create_snapshot', {
        p_company_id: this.companyId,
        p_snapshot_type: snapshotType,
        p_as_of_date: asOfDate || new Date().toISOString().slice(0, 10),
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data: data as string }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SNAPSHOT_FAILED' }
    }
  }
}
