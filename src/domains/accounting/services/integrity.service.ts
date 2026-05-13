import type { SupabaseClient } from '@supabase/supabase-js'
import { JournalRepository } from '../repositories/journal.repository'
import { AccountRepository } from '../repositories/account.repository'
import { IntegrityCheckRepository } from '../repositories/recurring.repository'
import type { ServiceResult } from '../types'

export interface IntegrityCheckResult {
  check_type: string
  status: 'passed' | 'failed' | 'warning'
  details: Record<string, unknown>
  timestamp: string
}

export class IntegrityService {
  private readonly journalRepo: JournalRepository
  private readonly accountRepo: AccountRepository
  private readonly checkRepo: IntegrityCheckRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.journalRepo = new JournalRepository(db, companyId)
    this.accountRepo = new AccountRepository(db, companyId)
    this.checkRepo = new IntegrityCheckRepository(db, companyId)
  }

  async runAllChecks(): Promise<ServiceResult<IntegrityCheckResult[]>> {
    const results: IntegrityCheckResult[] = []

    const checks = [
      this.checkBalancedEntries.bind(this),
      this.checkOrphanedLines.bind(this),
      this.checkDuplicatePostings.bind(this),
      this.checkAccountBalances.bind(this),
      this.checkTrialBalance.bind(this),
      this.checkMissingPeriods.bind(this),
    ]

    for (const check of checks) {
      try {
        const result = await check()
        results.push(result)
        await this.checkRepo.logCheck(result.check_type, result.status, result.details)
      } catch (e: any) {
        const result: IntegrityCheckResult = {
          check_type: check.name,
          status: 'failed',
          details: { error: e.message },
          timestamp: new Date().toISOString(),
        }
        results.push(result)
        await this.checkRepo.logCheck(check.name, 'failed', { error: e.message })
      }
    }

    return { ok: true, data: results }
  }

  async checkBalancedEntries(): Promise<IntegrityCheckResult> {
    const { data, error } = await this.db.rpc('check_unbalanced_entries', {
      p_company_id: this.companyId,
    })

    if (error) throw error
    const entries = data as Array<{ entry_id: string; entry_number: string; debit_diff: number }> ?? []

    return {
      check_type: 'checkBalancedEntries',
      status: entries.length === 0 ? 'passed' : 'failed',
      details: {
        unbalanced_count: entries.length,
        entries: entries.slice(0, 20),
      },
      timestamp: new Date().toISOString(),
    }
  }

  async checkOrphanedLines(): Promise<IntegrityCheckResult> {
    const { data, error } = await this.db.rpc('check_orphaned_lines', {
      p_company_id: this.companyId,
    })

    if (error) throw error
    const lines = (data as Array<{ line_id: string; journal_entry_id: string }>) ?? []

    return {
      check_type: 'checkOrphanedLines',
      status: lines.length === 0 ? 'passed' : 'failed',
      details: {
        orphaned_count: lines.length,
        lines: lines.slice(0, 20),
      },
      timestamp: new Date().toISOString(),
    }
  }

  async checkDuplicatePostings(): Promise<IntegrityCheckResult> {
    const { data, error } = await this.db
      .from('journal_entries')
      .select('source, source_id, count')
      .eq('company_id', this.companyId)
      .eq('status', 'posted')
      .not('source_id', 'is', null)
      .not('source', 'in', '("manual","reversal")')

    if (error) throw error

    const sourceCounts = new Map<string, number>()
    for (const row of (data ?? []) as any[]) {
      const key = `${row.source}:${row.source_id}`
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1)
    }

    const duplicates = Array.from(sourceCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }))

    return {
      check_type: 'checkDuplicatePostings',
      status: duplicates.length === 0 ? 'passed' : 'warning',
      details: {
        duplicate_count: duplicates.length,
        duplicates: duplicates.slice(0, 20),
      },
      timestamp: new Date().toISOString(),
    }
  }

  async checkAccountBalances(): Promise<IntegrityCheckResult> {
    const accounts = await this.accountRepo.findAllActive()
    const issues: Array<{ id: string; code: string; name: string; expected: number; actual: number }> = []

    for (const account of accounts) {
      const { data: totals } = await this.db
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('account_id', account.id)
        .eq('journal_entries.company_id', this.companyId)
        .eq('journal_entries.status', 'posted')

      const totalDebit = (totals || []).reduce((s: number, r: any) => s + Number(r.debit || 0), 0)
      const totalCredit = (totals || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0)

      const expectedBalance = account.normal_balance === 'debit'
        ? totalDebit - totalCredit
        : totalCredit - totalDebit

      if (Math.abs(expectedBalance - account.current_balance) > 0.01) {
        issues.push({
          id: account.id,
          code: account.code,
          name: account.name,
          expected: expectedBalance,
          actual: account.current_balance,
        })
      }
    }

    return {
      check_type: 'checkAccountBalances',
      status: issues.length === 0 ? 'passed' : 'failed',
      details: {
        mismatched_count: issues.length,
        accounts: issues.slice(0, 20),
      },
      timestamp: new Date().toISOString(),
    }
  }

  async checkTrialBalance(): Promise<IntegrityCheckResult> {
    const accounts = await this.accountRepo.findAllActive()
    let totalDebit = 0
    let totalCredit = 0

    for (const account of accounts) {
      if (account.normal_balance === 'debit') {
        totalDebit += account.current_balance
      } else {
        totalCredit += account.current_balance
      }
    }

    const difference = Math.abs(totalDebit - totalCredit)
    const isBalanced = difference < 0.01

    return {
      check_type: 'checkTrialBalance',
      status: isBalanced ? 'passed' : 'failed',
      details: {
        total_debit: totalDebit,
        total_credit: totalCredit,
        difference,
      },
      timestamp: new Date().toISOString(),
    }
  }

  async checkMissingPeriods(): Promise<IntegrityCheckResult> {
    const { data, error } = await this.db
      .from('journal_entries')
      .select('id, entry_number, date')
      .eq('company_id', this.companyId)
      .eq('status', 'posted')
      .is('period_id', null)
      .limit(20)

    if (error) throw error
    const missing = (data ?? []) as Array<{ id: string; entry_number: string; date: string }>

    return {
      check_type: 'checkMissingPeriods',
      status: missing.length === 0 ? 'passed' : 'warning',
      details: {
        missing_count: missing.length,
        entries: missing,
      },
      timestamp: new Date().toISOString(),
    }
  }

  async getCheckHistory(limit = 50): Promise<ServiceResult<any[]>> {
    try {
      const checks = await this.checkRepo.getRecent(limit)
      return { ok: true, data: checks }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getFailures(checkType?: string): Promise<ServiceResult<any[]>> {
    try {
      const failures = await this.checkRepo.getFailures(checkType)
      return { ok: true, data: failures }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }
}
