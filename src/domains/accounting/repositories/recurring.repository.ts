import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from '@/repositories/base.repository'
import type { RecurringJournalEntity, RecurringJournalLogEntity } from '../entities/recurring.entity'

export class RecurringJournalRepository extends BaseRepository<RecurringJournalEntity> {
  protected readonly table = 'recurring_journals'
  protected hasSoftDelete = false

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findDue(processDate?: string): Promise<RecurringJournalEntity[]> {
    const date = processDate || new Date().toISOString().slice(0, 10)
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('status', 'active')
      .lte('next_run_date', date)
      .order('next_run_date', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as RecurringJournalEntity[]
  }

  async findDueForCompany(companyId: string, processDate?: string): Promise<RecurringJournalEntity[]> {
    const date = processDate || new Date().toISOString().slice(0, 10)
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .lte('next_run_date', date)
      .order('next_run_date', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as RecurringJournalEntity[]
  }

  async updateNextRun(id: string, nextRunDate: string | null, totalRuns: number, lastRunDate: string): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .update({
        next_run_date: nextRunDate,
        total_runs: totalRuns,
        last_run_date: lastRunDate,
      })
      .eq('id', id)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async markCompleted(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .update({ status: 'completed' })
      .eq('id', id)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async logRun(input: {
    recurring_journal_id: string
    journal_entry_id?: string | null
    run_date: string
    status: string
    error_message?: string | null
  }): Promise<RecurringJournalLogEntity> {
    const { data, error } = await this.db
      .from('recurring_journal_log')
      .insert(input)
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as RecurringJournalLogEntity
  }

  async getLogs(recurringId: string): Promise<RecurringJournalLogEntity[]> {
    const { data, error } = await this.db
      .from('recurring_journal_log')
      .select('*')
      .eq('recurring_journal_id', recurringId)
      .order('run_date', { ascending: false })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as RecurringJournalLogEntity[]
  }
}

export class IntegrityCheckRepository extends BaseRepository<any> {
  protected readonly table = 'integrity_checks'
  protected hasSoftDelete = false

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async logCheck(checkType: string, status: string, details?: Record<string, unknown>): Promise<any> {
    return this.create({
      check_type: checkType,
      status,
      details: details ?? null,
      checked_at: new Date().toISOString(),
    })
  }

  async getRecent(limit = 50): Promise<any[]> {
    return this.findMany({ limit, orderBy: 'checked_at', ascending: false })
  }

  async getFailures(checkType?: string): Promise<any[]> {
    let q = this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .in('status', ['failed', 'warning'])
      .order('checked_at', { ascending: false })

    if (checkType) q = q.eq('check_type', checkType)

    const { data, error } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as any[]
  }
}
