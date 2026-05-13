import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from '@/repositories/base.repository'
import type { ReconciliationEntity, AgedItem, CustomerBalance } from '../entities/reconciliation.entity'

export class ReconciliationRepository extends BaseRepository<ReconciliationEntity> {
  protected readonly table = 'reconciliations'
  protected hasSoftDelete = false

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findByIdWithLines(id: string): Promise<ReconciliationEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(`
        *,
        reconciliation_lines (*)
      `)
      .eq('company_id', this.companyId)
      .eq('id', id)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as ReconciliationEntity
  }

  async findPaged(opts: {
    accountId?: string
    status?: string
    fromDate?: string
    toDate?: string
    page: number
    limit: number
  }): Promise<{ data: ReconciliationEntity[]; count: number }> {
    let q = this.db
      .from(this.table)
      .select('*', { count: 'exact' })
      .eq('company_id', this.companyId)
      .order('created_at', { ascending: false })
      .range((opts.page - 1) * opts.limit, opts.page * opts.limit - 1)

    if (opts.accountId) q = q.eq('account_id', opts.accountId)
    if (opts.status) q = q.eq('status', opts.status)
    if (opts.fromDate) q = q.gte('statement_date', opts.fromDate)
    if (opts.toDate) q = q.lte('statement_date', opts.toDate)

    const { data, error, count } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return { data: (data ?? []) as unknown as ReconciliationEntity[], count: count ?? 0 }
  }

  async findUnmatched(accountId?: string): Promise<ReconciliationEntity[]> {
    let q = this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .in('status', ['unmatched', 'partial'])
      .order('statement_date', { ascending: false })

    if (accountId) q = q.eq('account_id', accountId)

    const { data, error } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as ReconciliationEntity[]
  }

  async createReconciliation(input: Record<string, unknown>): Promise<ReconciliationEntity> {
    return this.create(input)
  }

  async matchReconciliation(id: string, clearedAmount: number, status: string): Promise<ReconciliationEntity> {
    return this.update(id, {
      cleared_amount: clearedAmount,
      status,
      reconciled_at: new Date().toISOString(),
    })
  }

  async getAgedReceivables(asOfDate?: string): Promise<AgedItem[]> {
    const date = asOfDate || new Date().toISOString().slice(0, 10)
    const { data, error } = await this.db.rpc('get_aged_receivables', {
      p_company_id: this.companyId,
      p_as_of_date: date,
    })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as AgedItem[]
  }

  async getAgedPayables(asOfDate?: string): Promise<AgedItem[]> {
    const date = asOfDate || new Date().toISOString().slice(0, 10)
    const { data, error } = await this.db.rpc('get_aged_payables', {
      p_company_id: this.companyId,
      p_as_of_date: date,
    })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as AgedItem[]
  }

  async getCustomerBalances(): Promise<CustomerBalance[]> {
    const { data, error } = await this.db
      .from('accounts')
      .select('id, name, name_ar')
      .eq('company_id', this.companyId)
      .eq('is_receivable', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
    if (error) throw new RepositoryError(error.message, error.code)

    const balances: CustomerBalance[] = []
    for (const account of data ?? []) {
      const { data: lines } = await this.db
        .from('journal_entry_lines')
        .select('debit, credit, journal_entries!inner(date, status)')
        .eq('account_id', account.id)
        .eq('journal_entries.company_id', this.companyId)
        .eq('journal_entries.status', 'posted')

      const totalDebit = (lines ?? []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0)
      const totalCredit = (lines ?? []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0)
      const sortedLines = [...(lines ?? [])].sort((a: any, b: any) =>
        new Date(b.journal_entries.date).getTime() - new Date(a.journal_entries.date).getTime())

      balances.push({
        account_id: account.id,
        account_name: account.name,
        account_name_ar: account.name_ar,
        total_debit: totalDebit,
        total_credit: totalCredit,
        balance: totalDebit - totalCredit,
        last_transaction_date: (sortedLines[0] as any)?.journal_entries?.date ?? null,
      })
    }
    return balances
  }
}
