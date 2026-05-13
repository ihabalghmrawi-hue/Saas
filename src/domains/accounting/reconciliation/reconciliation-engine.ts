import type { SupabaseClient } from '@supabase/supabase-js'
import { ReconciliationRepository } from '../repositories/reconciliation.repository'
import { JournalRepository } from '../repositories/journal.repository'
import { AccountingEventBus } from '../events/event-bus'
import type { ReconciliationEntity } from '../entities/reconciliation.entity'
import type { ServiceResult } from '../types'

export class ReconciliationEngine {
  private readonly repo: ReconciliationRepository
  private readonly journalRepo: JournalRepository
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new ReconciliationRepository(db, companyId)
    this.journalRepo = new JournalRepository(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async createReconciliation(input: {
    account_id: string
    reference_type: string
    reference_id?: string
    reference_number?: string
    statement_date: string
    statement_amount: number
    notes?: string
  }): Promise<ServiceResult<ReconciliationEntity>> {
    try {
      const reconciliation = await this.repo.create({
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
      return { ok: true, data: reconciliation }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CREATE_FAILED' }
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

    const reconcilable = (journalLines ?? []).filter((l: any) => {
      const amount = Number(l.debit || l.credit)
      return amount > 0 && amount <= Math.abs(reconciliation.statement_amount)
    })

    const candidates = reconcilable.sort((a: any, b: any) =>
      new Date(a.journal_entries.date).getTime() - new Date(b.journal_entries.date).getTime())

    let remaining = Math.abs(reconciliation.statement_amount)
    const matchedLines: Array<{
      reconciliation_id: string
      journal_entry_id: string
      amount: number
      matched_amount: number
      status: string
    }> = []

    for (const line of candidates as any[]) {
      if (remaining <= 0) break
      const lineAmount = Number(line.debit || line.credit)
      const matchAmount = Math.min(lineAmount, remaining)

      matchedLines.push({
        reconciliation_id: reconciliationId,
        journal_entry_id: line.journal_entry_id,
        amount: lineAmount,
        matched_amount: matchAmount,
        status: 'matched',
      })
      remaining -= matchAmount
    }

    const clearedAmount = Math.abs(reconciliation.statement_amount) - Math.max(remaining, 0)
    const newStatus = remaining <= 0 ? 'matched' : 'partial'

    if (matchedLines.length > 0) {
      const { error } = await this.db.from('reconciliation_lines').insert(matchedLines as any)
      if (error) throw error
    }

    const updated = await this.repo.matchReconciliation(reconciliationId, clearedAmount, newStatus)

    this.eventBus.emit('accounting.reconciliation.matched', {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'manual',
      companyId: this.companyId,
      amount: clearedAmount,
      description: `تسوية تلقائية: ${reconciliation.statement_date}`,
      reference: reconciliation.reference_number || '',
      timestamp: new Date().toISOString(),
      metadata: { reconciliationId, matchedLines: matchedLines.length },
    })

    return { ok: true, data: updated }
  }

  async matchLine(
    reconciliationId: string,
    lineInput: {
      journal_entry_id: string
      amount: number
      notes?: string
    },
  ): Promise<ServiceResult<ReconciliationEntity>> {
    const reconciliation = await this.repo.findByIdWithLines(reconciliationId)
    if (!reconciliation) return { ok: false, error: 'التسوية غير موجودة', code: 'NOT_FOUND' }

    const { error } = await this.db.from('reconciliation_lines').insert({
      reconciliation_id: reconciliationId,
      journal_entry_id: lineInput.journal_entry_id,
      amount: lineInput.amount,
      matched_amount: lineInput.amount,
      status: 'matched',
      notes: lineInput.notes || null,
    })
    if (error) return { ok: false, error: error.message, code: 'INSERT_FAILED' }

    const newCleared = reconciliation.cleared_amount + lineInput.amount
    const newStatus = Math.abs(newCleared - reconciliation.statement_amount) < 0.01 ? 'matched' : 'partial'
    const updated = await this.repo.matchReconciliation(reconciliationId, newCleared, newStatus)

    return { ok: true, data: updated }
  }

  async getAgedReceivables(asOfDate?: string): Promise<ServiceResult<any>> {
    try {
      const items = await this.repo.getAgedReceivables(asOfDate)
      const report = this.buildAgedReport(items)
      return { ok: true, data: report }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getAgedPayables(asOfDate?: string): Promise<ServiceResult<any>> {
    try {
      const items = await this.repo.getAgedPayables(asOfDate)
      const report = this.buildAgedReport(items)
      return { ok: true, data: report }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  private buildAgedReport(items: any[]): any {
    const buckets: Record<string, { total: number; items: any[] }> = {
      '0-30': { total: 0, items: [] },
      '31-60': { total: 0, items: [] },
      '61-90': { total: 0, items: [] },
      '90+': { total: 0, items: [] },
    }

    for (const item of items) {
      const bucket = item.aging_bucket as string
      if (bucket in buckets) {
        buckets[bucket].items.push(item)
        buckets[bucket].total += Number(item.amount || 0)
      }
    }

    const total = Object.values(buckets).reduce((s, b) => s + b.total, 0)
    return { total, buckets }
  }
}
