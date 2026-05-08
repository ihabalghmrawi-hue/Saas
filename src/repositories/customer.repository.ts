import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from './base.repository'
import type { CustomerResponse } from '@/validators/customer'

export class CustomerRepository extends BaseRepository<CustomerResponse> {
  protected readonly table = 'parties'
  protected hasSoftDelete  = true

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findByPhone(phone: string): Promise<CustomerResponse | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .eq('phone', phone)
      .eq('is_deleted', false)
      .eq('type', 'customer')
      .maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as CustomerResponse | null
  }

  async search(query: string, limit = 20): Promise<CustomerResponse[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_deleted', false)
      .eq('type', 'customer')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(limit)
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as CustomerResponse[]
  }

  async listPaged(opts: { limit: number; offset: number; type?: 'customer' | 'supplier' }): Promise<{ data: CustomerResponse[]; count: number }> {
    let q = this.db
      .from(this.table)
      .select('*', { count: 'exact' })
      .eq('company_id', this.companyId)
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .range(opts.offset, opts.offset + opts.limit - 1)

    if (opts.type) q = q.eq('type', opts.type) as typeof q

    const { data, error, count } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return { data: (data ?? []) as CustomerResponse[], count: count ?? 0 }
  }

  async countActive(): Promise<number> {
    const { count, error } = await this.db
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
      .eq('is_deleted', false)
      .eq('type', 'customer')
    if (error) throw new RepositoryError(error.message, error.code)
    return count ?? 0
  }
}
