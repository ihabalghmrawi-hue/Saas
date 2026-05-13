import type { SupabaseClient } from '@supabase/supabase-js'

export class RepositoryError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export abstract class BaseSalesRepository<T extends Record<string, unknown>> {
  constructor(
    protected readonly db: SupabaseClient,
    protected readonly companyId: string,
    protected readonly tableName: string,
  ) {}

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('company_id', this.companyId)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new RepositoryError(error.message, error.code)
    }
    return data as T
  }

  async findMany(opts?: {
    filters?: Record<string, any>; orderBy?: string; orderDir?: 'asc' | 'desc'
    limit?: number; offset?: number
  }): Promise<T[]> {
    let query = this.db.from(this.tableName).select('*').eq('company_id', this.companyId)
    if (opts?.filters) {
      for (const [key, value] of Object.entries(opts.filters)) {
        if (value !== undefined && value !== null) query = query.eq(key, value)
      }
    }
    if (opts?.orderBy) query = query.order(opts.orderBy, { ascending: opts?.orderDir !== 'desc' })
    if (opts?.limit) query = query.limit(opts.limit)
    if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts?.limit || 20) - 1)
    const { data, error } = await query
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as T[]
  }

  async create(input: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert({ company_id: this.companyId, ...input })
      .select('*')
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as T
  }

  async update(id: string, input: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db
      .from(this.tableName)
      .update(input)
      .eq('id', id)
      .eq('company_id', this.companyId)
      .select('*')
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as T
  }

  async count(filters?: Record<string, any>): Promise<number> {
    let query = this.db.from(this.tableName).select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) query = query.eq(key, value)
      }
    }
    const { count, error } = await query
    if (error) throw new RepositoryError(error.message, error.code)
    return count || 0
  }
}
