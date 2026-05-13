import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from '@/repositories/base.repository'
import type { AccountEntity, CreateAccountInput, UpdateAccountInput, AccountTree, DailyBalance } from '../entities/account.entity'

const ACCOUNT_SELECT = `
  id, company_id, code, name, name_ar, type, subtype, parent_id,
  level, is_postable, is_header, normal_balance, current_balance,
  opening_balance, account_group, is_active, is_system,
  is_receivable, is_payable, currency, tax_rate, description,
  is_deleted, created_at, updated_at
`

export class AccountRepository extends BaseRepository<AccountEntity> {
  protected readonly table = 'accounts'

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findActiveById(id: string): Promise<AccountEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as AccountEntity
  }

  async findByCode(code: string): Promise<AccountEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .eq('code', code)
      .eq('is_deleted', false)
      .maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as AccountEntity | null
  }

  async findChildren(parentId: string): Promise<AccountEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .eq('parent_id', parentId)
      .eq('is_deleted', false)
      .order('code', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as AccountEntity[]
  }

  async findDescendantIds(accountId: string): Promise<string[]> {
    const { data, error } = await this.db.rpc('get_account_descendants', {
      p_account_id: accountId,
      p_company_id: this.companyId,
    })
    if (error) {
      const all = await this.findAllActive()
      const descendants: string[] = []
      const collect = (parentId: string) => {
        for (const a of all) {
          if (a.parent_id === parentId) {
            descendants.push(a.id)
            collect(a.id)
          }
        }
      }
      collect(accountId)
      return descendants
    }
    return (data ?? []) as string[]
  }

  async findAllActive(): Promise<AccountEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('code', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as AccountEntity[]
  }

  async findRootAccounts(): Promise<AccountEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .is('parent_id', null)
      .eq('is_deleted', false)
      .order('code', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as AccountEntity[]
  }

  async getAccountTree(): Promise<AccountTree[]> {
    const accounts = await this.findAllActive()
    const buildTree = (parentId: string | null, level: number): AccountTree[] =>
      accounts
        .filter(a => (a.parent_id ?? null) === parentId)
        .map(a => ({
          ...a,
          children: buildTree(a.id, level + 1),
        }))
    return buildTree(null, 1)
  }

  async getByType(type: AccountEntity['type']): Promise<AccountEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .eq('type', type)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('code', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as AccountEntity[]
  }

  async createAccount(input: CreateAccountInput): Promise<AccountEntity> {
    return this.create(input as unknown as Record<string, unknown>)
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<AccountEntity> {
    return this.update(id, input as unknown as Record<string, unknown>)
  }

  async toggleActive(id: string, isActive: boolean): Promise<AccountEntity> {
    return this.update(id, { is_active: isActive })
  }

  async getDailyBalances(accountId: string, fromDate: string, toDate: string): Promise<DailyBalance[]> {
    const { data, error } = await this.db
      .from('account_balances_daily')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('account_id', accountId)
      .gte('as_of_date', fromDate)
      .lte('as_of_date', toDate)
      .order('as_of_date', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as DailyBalance[]
  }

  async searchAccounts(query: string, limit = 20): Promise<AccountEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(ACCOUNT_SELECT)
      .eq('company_id', this.companyId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .or(`name.ilike.%${query}%,name_ar.ilike.%${query}%,code.ilike.%${query}%`)
      .limit(limit)
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as AccountEntity[]
  }

  async updateBalance(accountId: string, balance: number): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .update({ current_balance: balance })
      .eq('id', accountId)
      .eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async bulkUpdateBalances(entries: Array<{ id: string; balance: number }>): Promise<void> {
    const { error } = await this.db.rpc('bulk_update_account_balances', {
      p_entries: entries,
      p_company_id: this.companyId,
    })
    if (error) throw new RepositoryError(error.message, error.code)
  }
}
