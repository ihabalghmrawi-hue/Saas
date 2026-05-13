// ============================================================
// Recurring Journals Engine
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecurringJournal, RecurringJournalLine } from './enterprise-types'
import { createJournalEntry } from './journal'

export class RecurringJournalEngine {
  private supabase: SupabaseClient
  private companyId: string

  constructor(supabase: SupabaseClient, companyId: string) {
    this.supabase = supabase
    this.companyId = companyId
  }

  async createTemplate(params: {
    name: string
    name_ar?: string
    description?: string
    frequency: RecurringJournal['frequency']
    interval_days?: number
    day_of_month?: number
    day_of_week?: number
    month_of_year?: number
    start_date: string
    end_date?: string
    max_runs?: number
    template_lines: RecurringJournalLine[]
    is_auto_post?: boolean
  }): Promise<{ ok: boolean; error?: string; id?: string }> {
    const nextRunDate = this.calculateNextRun(params.frequency, params.start_date, params)

    const { data, error } = await this.supabase
      .from('recurring_journals')
      .insert({
        company_id: this.companyId,
        name: params.name,
        name_ar: params.name_ar,
        description: params.description,
        frequency: params.frequency,
        interval_days: params.interval_days,
        day_of_month: params.day_of_month,
        day_of_week: params.day_of_week,
        month_of_year: params.month_of_year,
        start_date: params.start_date,
        end_date: params.end_date,
        next_run_date: nextRunDate,
        max_runs: params.max_runs,
        template_lines: params.template_lines as any,
        is_auto_post: params.is_auto_post ?? true,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data.id }
  }

  async processDueJournals(): Promise<Array<{ id: string; status: string; error?: string }>> {
    const today = new Date().toISOString().slice(0, 10)
    const results: Array<{ id: string; status: string; error?: string }> = []

    const { data: due } = await this.supabase
      .from('recurring_journals')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('status', 'active')
      .lte('next_run_date', today)
      .order('next_run_date', { ascending: true })

    for (const journal of (due || []) as any[]) {
      try {
        await this.executeJournal(journal)
        results.push({ id: journal.id, status: 'success' })
      } catch (err: any) {
        results.push({ id: journal.id, status: 'failed', error: err.message })
        await this.supabase.from('recurring_journal_log').insert({
          recurring_journal_id: journal.id,
          run_date: today,
          status: 'failed',
          error_message: err.message,
        })
      }
    }

    return results
  }

  private async executeJournal(journal: any): Promise<void> {
    const lines = (journal.template_lines || []) as RecurringJournalLine[]

    if (lines.length < 2) {
      throw new Error('قالب القيد لا يحتوي على سطور كافية')
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new Error('القيد المتكرر غير متوازن')
    }

    const entryLines = lines
      .filter(l => l.account_code && (l.debit > 0 || l.credit > 0))
      .map(l => ({
        account_code: l.account_code,
        debit: l.debit,
        credit: l.credit,
        description: l.description || journal.description,
      }))

    const result = await createJournalEntry(this.supabase, {
      company_id: this.companyId,
      description: journal.name_ar || journal.name,
      description_ar: journal.name_ar || journal.name,
      reference: `RC-${journal.id.slice(0, 8)}`,
      source: 'recurring',
      source_id: journal.id,
      source_document: `Recurring: ${journal.name}`,
      lines: entryLines,
      auto_generated: journal.is_auto_post,
    })

    const today = new Date().toISOString().slice(0, 10)

    await this.supabase.from('recurring_journal_log').insert({
      recurring_journal_id: journal.id,
      journal_entry_id: result.journal_id,
      run_date: today,
      status: 'success',
    })

    const nextRun = this.calculateNextRun(
      journal.frequency,
      today,
      journal,
    )

    const totalRuns = (journal.total_runs || 0) + 1
    const newStatus = journal.max_runs && totalRuns >= journal.max_runs
      ? 'completed'
      : 'active'

    await this.supabase
      .from('recurring_journals')
      .update({
        last_run_date: today,
        next_run_date: nextRun,
        total_runs: totalRuns,
        status: newStatus,
      })
      .eq('id', journal.id)
  }

  private calculateNextRun(
    frequency: string,
    fromDate: string,
    params: any,
  ): string {
    const d = new Date(fromDate)

    switch (frequency) {
      case 'daily':
        d.setDate(d.getDate() + 1)
        break
      case 'weekly':
        d.setDate(d.getDate() + 7)
        break
      case 'monthly': {
        const dom = params.day_of_month || d.getDate()
        d.setMonth(d.getMonth() + 1)
        d.setDate(Math.min(dom, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
        break
      }
      case 'quarterly':
        d.setMonth(d.getMonth() + 3)
        break
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1)
        break
      case 'custom':
        d.setDate(d.getDate() + (params.interval_days || 30))
        break
      default:
        d.setMonth(d.getMonth() + 1)
    }

    return d.toISOString().slice(0, 10)
  }
}
