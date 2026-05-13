import type { SupabaseClient } from '@supabase/supabase-js'
import { RecurringJournalRepository } from '../repositories/recurring.repository'
import { JournalService } from '../services/journal.service'
import { AccountingEventBus } from '../events/event-bus'
import type { RecurringJournalEntity } from '../entities/recurring.entity'

export class RecurringJournalWorker {
  private readonly recurringRepo: RecurringJournalRepository
  private readonly journalService: JournalService
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.recurringRepo = new RecurringJournalRepository(db, companyId)
    this.journalService = new JournalService(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async processDueJournals(processDate?: string): Promise<{
    processed: number
    failed: number
    skipped: number
    errors: string[]
  }> {
    const date = processDate || new Date().toISOString().slice(0, 10)
    const dueJournals = await this.recurringRepo.findDueForCompany(this.companyId, date)

    let processed = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const journal of dueJournals) {
      try {
        const result = await this.executeJournal(journal, date)
        if (result.success) {
          processed++
        } else {
          failed++
          errors.push(result.error || 'فشل غير معروف')
        }
      } catch (e: any) {
        failed++
        errors.push(e.message)
        await this.recurringRepo.logRun({
          recurring_journal_id: journal.id,
          run_date: date,
          status: 'failed',
          error_message: e.message,
        })
      }
    }

    return { processed, failed, skipped, errors }
  }

  private async executeJournal(
    journal: RecurringJournalEntity,
    runDate: string,
  ): Promise<{ success: boolean; error?: string }> {
    const templateLines = journal.template_lines
    if (!templateLines || templateLines.length < 2) {
      await this.recurringRepo.logRun({
        recurring_journal_id: journal.id,
        run_date: runDate,
        status: 'skipped',
        error_message: 'لا توجد بنود قالب كافية',
      })
      return { success: false, error: 'لا توجد بنود قالب كافية' }
    }

    const lines = templateLines.map((l, i) => ({
      account_code: l.account_code,
      debit: l.debit,
      credit: l.credit,
      description: l.description || journal.description || undefined,
      cost_center_id: l.cost_center_id || undefined,
      branch_id: l.branch_id || undefined,
    }))

    const result = await this.journalService.create({
      company_id: this.companyId,
      description: journal.description || journal.name,
      description_ar: journal.name_ar || journal.name,
      source: 'recurring',
      source_id: journal.id,
      reference: `${journal.name}-${runDate}`,
      date: runDate,
      lines,
    })

    if (!result.ok) {
      await this.recurringRepo.logRun({
        recurring_journal_id: journal.id,
        run_date: runDate,
        status: 'failed',
        error_message: result.error,
      })
      return { success: false, error: result.error }
    }

    const nextRunDate = this.calculateNextRun(journal, runDate)
    const totalRuns = journal.total_runs + 1

    if (journal.max_runs && totalRuns >= journal.max_runs) {
      await this.recurringRepo.markCompleted(journal.id)
    } else {
      await this.recurringRepo.updateNextRun(journal.id, nextRunDate, totalRuns, runDate)
    }

    await this.recurringRepo.logRun({
      recurring_journal_id: journal.id,
      journal_entry_id: result.data.journal_id,
      run_date: runDate,
      status: 'success',
    })

    this.eventBus.emit('accounting.recurring.executed', {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'manual',
      companyId: this.companyId,
      journalEntryId: result.data.journal_id,
      entryNumber: result.data.entry_number,
      amount: lines.reduce((s, l) => s + l.debit, 0),
      description: `تشغيل قيد دوري: ${journal.name}`,
      reference: journal.id,
      timestamp: new Date().toISOString(),
      metadata: { nextRunDate, totalRuns },
    })

    return { success: true }
  }

  private calculateNextRun(journal: RecurringJournalEntity, fromDate: string): string | null {
    const date = new Date(fromDate)

    if (journal.end_date && date >= new Date(journal.end_date)) {
      return null
    }

    let nextDate: Date

    switch (journal.frequency) {
      case 'daily':
        nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)
        break
      case 'weekly':
        nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 7)
        break
      case 'monthly': {
        nextDate = new Date(date)
        const nextMonth = nextDate.getMonth() + 1
        nextDate.setMonth(nextMonth)
        if (journal.day_of_month) {
          nextDate.setDate(journal.day_of_month)
        }
        break
      }
      case 'quarterly':
        nextDate = new Date(date)
        nextDate.setMonth(nextDate.getMonth() + 3)
        break
      case 'yearly':
        nextDate = new Date(date)
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        if (journal.month_of_year) {
          nextDate.setMonth(journal.month_of_year - 1)
        }
        if (journal.day_of_month) {
          nextDate.setDate(journal.day_of_month)
        }
        break
      case 'custom':
        if (journal.interval_days) {
          nextDate = new Date(date)
          nextDate.setDate(nextDate.getDate() + journal.interval_days)
        } else {
          return null
        }
        break
      default:
        return null
    }

    if (journal.end_date && nextDate > new Date(journal.end_date)) {
      return null
    }

    return nextDate.toISOString().slice(0, 10)
  }
}
