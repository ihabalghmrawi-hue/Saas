import type { SupabaseClient } from '@supabase/supabase-js'

export interface FindManyOptions {
  select?:     string
  limit?:      number
  offset?:     number
  orderBy?:    string
  ascending?:  boolean
  softDelete?: boolean
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

/**
 * Generic base repository. All queries are scoped to company_id.
 * Subclasses declare `table` and `hasSoftDelete` then add domain queries.
 */
export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected abstract readonly table: string
  protected hasSoftDelete = true

  constructor(
    protected readonly db: SupabaseClient,
    protected readonly companyId: string,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findById(id: string, select = '*'): Promise<T | null> {
    let q = this.db
      .from(this.table)
      .select(select)
      .eq('company_id', this.companyId)
      .eq('id', id)

    if (this.hasSoftDelete) q = q.eq('is_deleted', false) as typeof q

    const { data, error } = await q.single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as T
  }

  async findMany(opts: FindManyOptions = {}): Promise<T[]> {
    const {
      select     = '*',
      limit      = 50,
      offset     = 0,
      orderBy    = 'created_at',
      ascending  = false,
      softDelete = this.hasSoftDelete,
    } = opts

    let q = this.db
      .from(this.table)
      .select(select)
      .eq('company_id', this.companyId)
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1)

    if (softDelete) q = q.eq('is_deleted', false) as typeof q

    const { data, error } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as T[]
  }

  async count(): Promise<number> {
    let q = this.db
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)

    if (this.hasSoftDelete) q = q.eq('is_deleted', false) as typeof q

    const { count, error } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return count ?? 0
  }

  async create(input: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db
      .from(this.table)
      .insert({ ...input, company_id: this.companyId })
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as T
  }

  async update(id: string, input: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db
      .from(this.table)
      .update(input)
      .eq('id', id)
      .eq('company_id', this.companyId)
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as T
  }

  async softDeleteById(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async hardDeleteById(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .delete()
      .eq('id', id)
      .eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
  }
}
