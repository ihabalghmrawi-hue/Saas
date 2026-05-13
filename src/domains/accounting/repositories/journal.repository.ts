import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from '@/repositories/base.repository'
import type { JournalEntryEntity, JournalLineEntity } from '../entities/journal.entity'

const JOURNAL_SELECT = `
  id, company_id, entry_number, date, description, description_ar,
  reference, source, source_id, source_document, status,
  approval_status, approved_by_id, approved_at, rejection_reason,
  reversal_reason, is_posted, is_balanced, auto_generated,
  total_debit, total_credit, fiscal_year_id, period_id,
  branch_id, cost_center_id, created_by_id,
  reversal_of, reversal_entry_id, currency, exchange_rate,
  tags, posted_at, created_at, updated_at
`

const JOURNAL_WITH_LINES_SELECT = `
  ${JOURNAL_SELECT},
  journal_entry_lines (
    id, journal_entry_id, account_id, debit, credit,
    description, cost_center_id, branch_id, line_number, created_at,
    accounts (code, name, name_ar)
  )
`

export class JournalRepository extends BaseRepository<JournalEntryEntity> {
  protected readonly table = 'journal_entries'

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findByIdWithLines(id: string): Promise<JournalEntryEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(JOURNAL_WITH_LINES_SELECT)
      .eq('company_id', this.companyId)
      .eq('id', id)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return this.mapEntry(data as any)
  }

  async findPaged(opts: {
    status?: string
    source?: string
    fromDate?: string
    toDate?: string
    periodId?: string
    fiscalYearId?: string
    search?: string
    branchId?: string | null
    costCenterId?: string | null
    page: number
    limit: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ data: JournalEntryEntity[]; count: number }> {
    let q = this.db
      .from(this.table)
      .select(JOURNAL_WITH_LINES_SELECT, { count: 'exact' })
      .eq('company_id', this.companyId)
      .order(opts.sortBy || 'date', { ascending: opts.sortOrder === 'asc' })
      .range((opts.page - 1) * opts.limit, opts.page * opts.limit - 1)

    if (opts.status) q = q.eq('status', opts.status)
    if (opts.source) q = q.eq('source', opts.source)
    if (opts.fromDate) q = q.gte('date', opts.fromDate)
    if (opts.toDate) q = q.lte('date', opts.toDate)
    if (opts.periodId) q = q.eq('period_id', opts.periodId)
    if (opts.fiscalYearId) q = q.eq('fiscal_year_id', opts.fiscalYearId)
    if (opts.branchId !== undefined) {
      q = opts.branchId ? q.eq('branch_id', opts.branchId) : q.is('branch_id', null)
    }
    if (opts.costCenterId !== undefined) {
      q = opts.costCenterId ? q.eq('cost_center_id', opts.costCenterId) : q.is('cost_center_id', null)
    }
    if (opts.search) {
      q = q.or(`description.ilike.%${opts.search}%,entry_number.ilike.%${opts.search}%,reference.ilike.%${opts.search}%`)
    }

    const { data, error, count } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return {
      data: ((data ?? []) as any[]).map(d => this.mapEntry(d)),
      count: count ?? 0,
    }
  }

  async findBySource(sourceId: string, source: string): Promise<JournalEntryEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(JOURNAL_WITH_LINES_SELECT)
      .eq('company_id', this.companyId)
      .eq('source_id', sourceId)
      .eq('source', source)
      .order('created_at', { ascending: false })
    if (error) throw new RepositoryError(error.message, error.code)
    return ((data ?? []) as any[]).map(d => this.mapEntry(d))
  }

  async getNextEntryNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `JE-${year}-`
    const { data } = await this.db
      .from(this.table)
      .select('entry_number')
      .eq('company_id', this.companyId)
      .like('entry_number', `${prefix}%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextNum = 1
    if (data?.entry_number) {
      const parts = (data.entry_number as string).split('-')
      const last = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(last)) nextNum = last + 1
    }
    return `${prefix}${String(nextNum).padStart(5, '0')}`
  }

  async updateStatus(id: string, status: string, extra?: Record<string, unknown>): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .update({ status, ...extra })
      .eq('id', id)
      .eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async findPostedInPeriod(periodId: string): Promise<JournalEntryEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(JOURNAL_SELECT)
      .eq('company_id', this.companyId)
      .eq('period_id', periodId)
      .eq('status', 'posted')
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as JournalEntryEntity[]
  }

  async countByStatus(status: string): Promise<number> {
    const { count, error } = await this.db
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
      .eq('status', status)
    if (error) throw new RepositoryError(error.message, error.code)
    return count ?? 0
  }

  async getLines(journalId: string): Promise<JournalLineEntity[]> {
    const { data, error } = await this.db
      .from('journal_entry_lines')
      .select(`
        id, journal_entry_id, account_id, debit, credit,
        description, cost_center_id, branch_id, line_number, created_at,
        accounts (code, name, name_ar)
      `)
      .eq('journal_entry_id', journalId)
      .order('line_number', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return ((data ?? []) as any[]).map(l => ({
      ...l,
      account_code: (l as any).accounts?.code,
      account_name: (l as any).accounts?.name,
      account_name_ar: (l as any).accounts?.name_ar,
    }))
  }

  async insertLines(lines: Array<{
    journal_entry_id: string
    account_id: string
    debit: number
    credit: number
    description?: string | null
    line_number: number
    cost_center_id?: string | null
    branch_id?: string | null
  }>): Promise<void> {
    const { error } = await this.db.from('journal_entry_lines').insert(lines as any)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async deleteLines(journalId: string): Promise<void> {
    const { error } = await this.db
      .from('journal_entry_lines')
      .delete()
      .eq('journal_entry_id', journalId)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  private mapEntry(d: any): JournalEntryEntity {
    const lines = d.journal_entry_lines
      ? (d.journal_entry_lines as any[]).map((l: any) => ({
          ...l,
          account_code: l.accounts?.code,
          account_name: l.accounts?.name,
          account_name_ar: l.accounts?.name_ar,
        }))
      : undefined
    const { journal_entry_lines, ...entry } = d
    return { ...entry, lines } as JournalEntryEntity
  }
}
