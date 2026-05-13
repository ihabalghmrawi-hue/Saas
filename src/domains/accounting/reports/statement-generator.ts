import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountRepository } from '../repositories/account.repository'
import { RepositoryError } from '@/repositories/base.repository'
import type { ServiceResult } from '../types'

export interface StatementLine {
  code: string
  name: string
  name_ar: string
  amount: number
  children?: StatementLine[]
}

export interface IncomeStatement {
  revenue: StatementLine[]
  cogs: StatementLine[]
  gross_profit: number
  operating_expenses: StatementLine[]
  operating_income: number
  other_income: StatementLine[]
  net_income: number
  period_from: string
  period_to: string
}

export interface BalanceSheet {
  assets: { current: StatementLine[]; fixed: StatementLine[]; total_assets: number }
  liabilities: { current: StatementLine[]; long_term: StatementLine[]; total_liabilities: number }
  equity: { capital: number; retained_earnings: number; net_income: number; total_equity: number }
  period_date: string
}

export interface TrialBalance {
  lines: Array<{
    account_id: string
    code: string
    name: string
    name_ar: string
    type: string
    opening_debit: number
    opening_credit: number
    period_debit: number
    period_credit: number
    closing_debit: number
    closing_credit: number
    balance: number
  }>
  total_debit: number
  total_credit: number
  is_balanced: boolean
}

export interface CashFlowStatement {
  operating: { items: StatementLine[]; total: number }
  investing: { items: StatementLine[]; total: number }
  financing: { items: StatementLine[]; total: number }
  net_change: number
  period_from: string
  period_to: string
}

export class StatementGenerator {
  private readonly accountRepo: AccountRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.accountRepo = new AccountRepository(db, companyId)
  }

  async generateTrialBalance(fromDate?: string, toDate?: string): Promise<ServiceResult<TrialBalance>> {
    try {
      const { data, error } = await this.db.rpc('ledger_get_trial_balance', {
        p_company_id: this.companyId,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      })

      if (error) throw new RepositoryError(error.message, error.code)

      const lines: TrialBalance['lines'] = (data ?? []).map((r: any) => ({
        account_id: r.account_id,
        code: r.account_code || r.code,
        name: r.account_name || r.name,
        name_ar: r.account_name_ar || r.name_ar || '',
        type: r.account_type || r.type,
        opening_debit: Number(r.opening_balance && r.normal_balance === 'debit' ? r.opening_balance : 0),
        opening_credit: Number(r.opening_balance && r.normal_balance === 'credit' ? r.opening_balance : 0),
        period_debit: Number(r.period_debit || r.total_debit || 0),
        period_credit: Number(r.period_credit || r.total_credit || 0),
        closing_debit: Number(r.closing_debit || (r.balance > 0 ? r.balance : 0)),
        closing_credit: Number(r.closing_credit || (r.balance < 0 ? Math.abs(r.balance) : 0)),
        balance: Number(r.balance || 0),
      }))

      const totalDebit = lines.reduce((s, l) => s + l.closing_debit, 0)
      const totalCredit = lines.reduce((s, l) => s + l.closing_credit, 0)

      return {
        ok: true,
        data: {
          lines,
          total_debit: totalDebit,
          total_credit: totalCredit,
          is_balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TRIAL_BALANCE_FAILED' }
    }
  }

  async generateIncomeStatement(fromDate: string, toDate: string): Promise<ServiceResult<IncomeStatement>> {
    try {
      const { data, error } = await this.db.rpc('get_income_statement', {
        p_company_id: this.companyId,
        p_from_date: fromDate,
        p_to_date: toDate,
      })

      if (error) throw new RepositoryError(error.message, error.code)

      const result = data as any || {}

      const revenue: StatementLine[] = (result.revenue || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const cogs: StatementLine[] = (result.cogs || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const expenses: StatementLine[] = (result.expenses || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))

      const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)
      const totalCogs = cogs.reduce((s, c) => s + c.amount, 0)
      const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
      const grossProfit = totalRevenue - totalCogs
      const operatingIncome = grossProfit - totalExpenses

      return {
        ok: true,
        data: {
          revenue,
          cogs,
          gross_profit: grossProfit,
          operating_expenses: expenses,
          operating_income: operatingIncome,
          other_income: [],
          net_income: operatingIncome,
          period_from: fromDate,
          period_to: toDate,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'INCOME_STATEMENT_FAILED' }
    }
  }

  async generateBalanceSheet(asOfDate?: string): Promise<ServiceResult<BalanceSheet>> {
    try {
      const date = asOfDate || new Date().toISOString().slice(0, 10)

      const { data, error } = await this.db.rpc('get_balance_sheet', {
        p_company_id: this.companyId,
        p_as_of_date: date,
      })

      if (error) throw new RepositoryError(error.message, error.code)

      const result = (data as any) || {}

      const currentAssets: StatementLine[] = (result.assets?.current || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const fixedAssets: StatementLine[] = (result.assets?.fixed || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const currentLiabilities: StatementLine[] = (result.liabilities?.current || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const longTermLiabilities: StatementLine[] = (result.liabilities?.long_term || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))

      const totalAssets = [...currentAssets, ...fixedAssets].reduce((s, a) => s + a.amount, 0)
      const totalLiabilities = [...currentLiabilities, ...longTermLiabilities].reduce((s, l) => s + l.amount, 0)

      const equity = result.equity || {}
      const capital = Number(equity.capital || 0)
      const retainedEarnings = Number(equity.retained_earnings || 0)
      const netIncome = Number(equity.net_income || 0)
      const totalEquity = capital + retainedEarnings + netIncome

      return {
        ok: true,
        data: {
          assets: { current: currentAssets, fixed: fixedAssets, total_assets: totalAssets },
          liabilities: { current: currentLiabilities, long_term: longTermLiabilities, total_liabilities: totalLiabilities },
          equity: { capital, retained_earnings: retainedEarnings, net_income: netIncome, total_equity: totalEquity },
          period_date: date,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'BALANCE_SHEET_FAILED' }
    }
  }

  async generateCashFlow(fromDate: string, toDate: string): Promise<ServiceResult<CashFlowStatement>> {
    try {
      const { data, error } = await this.db.rpc('get_cash_flow', {
        p_company_id: this.companyId,
        p_from_date: fromDate,
        p_to_date: toDate,
      })

      if (error) throw new RepositoryError(error.message, error.code)

      const result = data as any || {}

      const operatingItems: StatementLine[] = (result.operating?.items || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const investingItems: StatementLine[] = (result.investing?.items || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))
      const financingItems: StatementLine[] = (result.financing?.items || []).map((r: any) => ({
        code: r.code, name: r.name, name_ar: r.name_ar, amount: Number(r.amount || 0),
      }))

      return {
        ok: true,
        data: {
          operating: { items: operatingItems, total: Number(result.operating?.total || 0) },
          investing: { items: investingItems, total: Number(result.investing?.total || 0) },
          financing: { items: financingItems, total: Number(result.financing?.total || 0) },
          net_change: Number(result.net_change || 0),
          period_from: fromDate,
          period_to: toDate,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CASH_FLOW_FAILED' }
    }
  }
}
