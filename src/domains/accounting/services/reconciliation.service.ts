import type { SupabaseClient } from '@supabase/supabase-js'
import { ReconciliationRepository } from '../repositories/reconciliation.repository'
import { CreateReconciliationSchema } from '../validators/reconciliation.schema'
import type { ReconciliationEntity, AgedReport, AgedItem, CustomerBalance, CreateReconciliationInput } from '../entities/reconciliation.entity'
import type { ServiceResult } from '../types'

export class ReconciliationService {
  private readonly repo: ReconciliationRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new ReconciliationRepository(db, companyId)
  }

  async create(input: CreateReconciliationInput): Promise<ServiceResult<ReconciliationEntity>> {
    const parsed = CreateReconciliationSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }
    }

    try {
      const reconciliation = await this.repo.createReconciliation({
        ...parsed.data,
        statement_amount: parsed.data.statement_amount,
        cleared_amount: 0,
        status: 'unmatched',
      })
      return { ok: true, data: reconciliation }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CREATE_FAILED' }
    }
  }

  async list(filters: {
    accountId?: string
    status?: string
    fromDate?: string
    toDate?: string
    page?: number
    limit?: number
  }): Promise<ServiceResult<{ data: ReconciliationEntity[]; count: number }>> {
    try {
      const result = await this.repo.findPaged({
        ...filters,
        page: filters.page || 1,
        limit: filters.limit || 50,
      })
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getUnmatched(accountId?: string): Promise<ServiceResult<ReconciliationEntity[]>> {
    try {
      const items = await this.repo.findUnmatched(accountId)
      return { ok: true, data: items }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async autoMatch(reconciliationId: string): Promise<ServiceResult<ReconciliationEntity>> {
    const reconciliation = await this.repo.findByIdWithLines(reconciliationId)
    if (!reconciliation) return { ok: false, error: 'التسوية غير موجودة', code: 'NOT_FOUND' }
    if (reconciliation.status === 'matched') return { ok: false, error: 'التسوية متطابقة بالفعل', code: 'ALREADY_MATCHED' }

    const { data: journalLines } = await this.db
      .from('journal_entry_lines')
      .select(`
        id, debit, credit, journal_entry_id,
        journal_entries!inner(id, date, entry_number, reference, source, status)
      `)
      .eq('account_id', reconciliation.account_id)
      .eq('journal_entries.company_id', this.companyId)
      .eq('journal_entries.status', 'posted')

    const reconcilableLines = (journalLines ?? []).filter((l: any) => {
      const amount = Number(l.debit || l.credit)
      return amount > 0
    })

    let remainingAmount = Math.abs(reconciliation.statement_amount)
    const matchedLines: Array<{
      reconciliation_id: string
      journal_entry_id: string
      amount: number
      matched_amount: number
      status: string
    }> = []

    for (const line of (reconcilableLines as any[])) {
      if (remainingAmount <= 0) break
      const lineAmount = Number(line.debit || line.credit)
      const matchAmount = Math.min(lineAmount, remainingAmount)

      matchedLines.push({
        reconciliation_id: reconciliationId,
        journal_entry_id: line.journal_entry_id,
        amount: lineAmount,
        matched_amount: matchAmount,
        status: lineAmount === matchAmount ? 'matched' : 'partial',
      })

      remainingAmount -= matchAmount
    }

    const clearedAmount = Math.abs(reconciliation.statement_amount) - remainingAmount
    const newStatus = remainingAmount <= 0 ? 'matched' : 'partial'

    if (matchedLines.length > 0) {
      const { error } = await this.db.from('reconciliation_lines').insert(matchedLines as any)
      if (error) throw error
    }

    const updated = await this.repo.matchReconciliation(reconciliationId, clearedAmount, newStatus)
    return { ok: true, data: updated }
  }

  async getAgedReceivables(asOfDate?: string): Promise<ServiceResult<AgedReport>> {
    try {
      const items = await this.repo.getAgedReceivables(asOfDate)
      return { ok: true, data: this.buildAgedReport(items) }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getAgedPayables(asOfDate?: string): Promise<ServiceResult<AgedReport>> {
    try {
      const items = await this.repo.getAgedPayables(asOfDate)
      return { ok: true, data: this.buildAgedReport(items) }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getCustomerBalances(): Promise<ServiceResult<CustomerBalance[]>> {
    try {
      const balances = await this.repo.getCustomerBalances()
      return { ok: true, data: balances }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  private buildAgedReport(items: AgedItem[]): AgedReport {
    const buckets: AgedReport['buckets'] = {
      '0-30': { total: 0, items: [] },
      '31-60': { total: 0, items: [] },
      '61-90': { total: 0, items: [] },
      '90+': { total: 0, items: [] },
    }

    for (const item of items) {
      const bucket = item.aging_bucket as keyof typeof buckets
      if (bucket in buckets) {
        buckets[bucket].items.push(item)
        buckets[bucket].total += item.amount
      }
    }

    const total = Object.values(buckets).reduce((s, b) => s + b.total, 0)
    return { total, buckets }
  }
}
