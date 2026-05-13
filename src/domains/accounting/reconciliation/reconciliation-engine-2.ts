import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import { AccountingEventBus } from '../events/event-bus'
import type { ServiceResult } from '../types'

export interface AgedEntry {
  account_id: string
  account_name: string
  entry_number: string
  invoice_date: string
  reference: string | null
  amount: number
  days_overdue: number
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+'
}

export interface AgedReport {
  total: number
  buckets: Record<string, { total: number; count: number; items: AgedEntry[] }>
}

export interface CustomerBalanceResult {
  account_id: string
  account_name: string
  account_name_ar: string
  balance: number
  last_transaction_date: string | null
}

export class ReconciliationEngine {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async getAgedReceivables(asOfDate?: string): Promise<ServiceResult<AgedReport>> {
    const date = asOfDate || new Date().toISOString().slice(0, 10)
    try {
      const { data, error } = await this.db.rpc('ledger_get_aged_receivables', {
        p_company_id: this.companyId,
        p_as_of_date: date,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data: this.buildReport((data ?? []) as AgedEntry[]) }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'AGED_RECEIVABLES_FAILED' }
    }
  }

  async getAgedPayables(asOfDate?: string): Promise<ServiceResult<AgedReport>> {
    const date = asOfDate || new Date().toISOString().slice(0, 10)
    try {
      const { data, error } = await this.db.rpc('ledger_get_aged_payables', {
        p_company_id: this.companyId,
        p_as_of_date: date,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data: this.buildReport((data ?? []) as AgedEntry[]) }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'AGED_PAYABLES_FAILED' }
    }
  }

  async getCustomerBalances(): Promise<ServiceResult<CustomerBalanceResult[]>> {
    try {
      const { data: accounts } = await this.db
        .from('accounts')
        .select('id, name, name_ar')
        .eq('company_id', this.companyId)
        .eq('is_receivable', true)
        .eq('is_active', true)
        .eq('is_deleted', false)

      const balances: CustomerBalanceResult[] = []
      for (const acct of (accounts ?? []) as any[]) {
        const { data } = await this.db.rpc('ledger_get_account_balance', {
          p_account_id: acct.id,
          p_company_id: this.companyId,
          p_as_of_date: null,
        })

        const { data: lastTx } = await this.db
          .from('journal_entry_lines')
          .select('journal_entries!inner(date)')
          .eq('account_id', acct.id)
          .eq('journal_entries.company_id', this.companyId)
          .eq('journal_entries.status', 'posted')
          .order('journal_entries.date', { ascending: false })
          .limit(1)
          .maybeSingle()

        balances.push({
          account_id: acct.id,
          account_name: acct.name,
          account_name_ar: acct.name_ar || acct.name,
          balance: Number(data) || 0,
          last_transaction_date: (lastTx as any)?.date || null,
        })
      }

      return { ok: true, data: balances }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CUSTOMER_BALANCES_FAILED' }
    }
  }

  async getSupplierBalances(): Promise<ServiceResult<CustomerBalanceResult[]>> {
    try {
      const { data: accounts } = await this.db
        .from('accounts')
        .select('id, name, name_ar')
        .eq('company_id', this.companyId)
        .eq('is_payable', true)
        .eq('is_active', true)
        .eq('is_deleted', false)

      const balances: CustomerBalanceResult[] = []
      for (const acct of (accounts ?? []) as any[]) {
        const { data } = await this.db.rpc('ledger_get_account_balance', {
          p_account_id: acct.id,
          p_company_id: this.companyId,
          p_as_of_date: null,
        })

        balances.push({
          account_id: acct.id,
          account_name: acct.name,
          account_name_ar: acct.name_ar || acct.name,
          balance: Number(data) || 0,
          last_transaction_date: null,
        })
      }

      return { ok: true, data: balances }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SUPPLIER_BALANCES_FAILED' }
    }
  }

  async createReconciliation(input: {
    account_id: string
    reference_type: string
    reference_id?: string
    reference_number?: string
    statement_date: string
    statement_amount: number
    notes?: string
  }): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await this.db
        .from('reconciliations')
        .insert({
          company_id: this.companyId,
          account_id: input.account_id,
          reference_type: input.reference_type,
          reference_id: input.reference_id || null,
          reference_number: input.reference_number || null,
          statement_date: input.statement_date,
          statement_amount: input.statement_amount,
          cleared_amount: 0,
          status: 'unmatched',
          notes: input.notes || null,
        })
        .select()
        .single()
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECONCILIATION_CREATE_FAILED' }
    }
  }

  async autoMatch(reconciliationId: string): Promise<ServiceResult<any>> {
    const { data: rec, error: fetchErr } = await this.db
      .from('reconciliations')
      .select('*')
      .eq('id', reconciliationId)
      .eq('company_id', this.companyId)
      .single()
    if (fetchErr || !rec) return { ok: false, error: 'التسوية غير موجودة', code: 'NOT_FOUND' }
    if ((rec as any).status === 'matched') return { ok: false, error: 'مطابقة بالفعل', code: 'ALREADY_MATCHED' }

    const statementAmount = Math.abs((rec as any).statement_amount)

    const { data: lines } = await this.db
      .from('journal_entry_lines')
      .select(`
        id, debit, credit, journal_entry_id,
        journal_entries!inner(id, date, entry_number, reference, status)
      `)
      .eq('account_id', (rec as any).account_id)
      .eq('journal_entries.company_id', this.companyId)
      .eq('journal_entries.status', 'posted')

    const candidates = ((lines ?? []) as any[])
      .map((l: any) => ({ id: l.id, journal_entry_id: l.journal_entry_id, amount: Number(l.debit || l.credit) }))
      .filter(l => l.amount > 0 && l.amount <= statementAmount)
      .sort((a, b) => b.amount - a.amount)

    let remaining = statementAmount
    const matches: Array<{
      reconciliation_id: string
      journal_entry_id: string
      amount: number
      matched_amount: number
      status: string
    }> = []

    for (const cand of candidates) {
      if (remaining <= 0) break
      const matchAmount = Math.min(cand.amount, remaining)
      matches.push({
        reconciliation_id: reconciliationId,
        journal_entry_id: cand.journal_entry_id,
        amount: cand.amount,
        matched_amount: matchAmount,
        status: 'matched',
      })
      remaining -= matchAmount
    }

    if (matches.length > 0) {
      const { error } = await this.db.from('reconciliation_lines').insert(matches as any)
      if (error) throw new RepositoryError(error.message, error.code)
    }

    const clearedAmount = statementAmount - Math.max(remaining, 0)
    const newStatus = remaining <= 0 ? 'matched' : 'partial'

    const { data: updated, error: updateErr } = await this.db
      .from('reconciliations')
      .update({
        cleared_amount: clearedAmount,
        status: newStatus,
        reconciled_at: new Date().toISOString(),
      })
      .eq('id', reconciliationId)
      .select()
      .single()
    if (updateErr) throw new RepositoryError(updateErr.message, updateErr.code)

    AccountingEventBus.getInstance().emit('accounting.reconciliation.completed', {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'manual',
      companyId: this.companyId,
      amount: clearedAmount,
      description: `تسوية ${newStatus === 'matched' ? 'كاملة' : 'جزئية'}`,
      timestamp: new Date().toISOString(),
      metadata: { reconciliationId, matchedLines: matches.length },
    })

    return { ok: true, data: updated }
  }

  async matchLine(
    reconciliationId: string,
    input: {
      journal_entry_id: string
      amount: number
      notes?: string
    },
  ): Promise<ServiceResult<any>> {
    const { data: rec } = await this.db
      .from('reconciliations')
      .select('*')
      .eq('id', reconciliationId)
      .eq('company_id', this.companyId)
      .single()

    if (!rec) return { ok: false, error: 'التسوية غير موجودة', code: 'NOT_FOUND' }

    const { error } = await this.db.from('reconciliation_lines').insert({
      reconciliation_id: reconciliationId,
      journal_entry_id: input.journal_entry_id,
      amount: input.amount,
      matched_amount: input.amount,
      status: 'matched',
      notes: input.notes || null,
    })
    if (error) throw new RepositoryError(error.message, error.code)

    const newCleared = Number((rec as any).cleared_amount || 0) + input.amount
    const newStatus = Math.abs(newCleared - Number((rec as any).statement_amount)) < 0.01 ? 'matched' : 'partial'

    const { data: updated } = await this.db
      .from('reconciliations')
      .update({ cleared_amount: newCleared, status: newStatus })
      .eq('id', reconciliationId)
      .select()
      .single()

    return { ok: true, data: updated }
  }

  private buildReport(items: AgedEntry[]): AgedReport {
    const bucketKeys = ['0-30', '31-60', '61-90', '90+']
    const buckets: Record<string, { total: number; count: number; items: AgedEntry[] }> = {}

    for (const key of bucketKeys) {
      buckets[key] = { total: 0, count: 0, items: [] }
    }

    for (const item of items) {
      const bucket = item.aging_bucket
      if (buckets[bucket]) {
        buckets[bucket].items.push(item)
        buckets[bucket].total += Number(item.amount || 0)
        buckets[bucket].count++
      }
    }

    const total = Object.values(buckets).reduce((s, b) => s + b.total, 0)
    return { total, buckets }
  }
}
