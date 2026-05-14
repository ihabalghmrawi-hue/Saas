import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type RepositoryEvent<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T | null
  old: T | null
}

export class BaseRepository<T extends { id: string }> {
  protected supabase: SupabaseClient
  protected tableName: string
  protected defaultPageSize = 50

  constructor(tableName: string) {
    this.supabase = createClient()
    this.tableName = tableName
  }

  async getAll(options?: {
    filters?: Record<string, unknown>
    orderBy?: { column: string; ascending?: boolean }
    page?: number
    pageSize?: number
  }): Promise<{ data: T[]; total: number; error?: string }> {
    try {
      let query = this.supabase.from(this.tableName).select('*', { count: 'exact' })

      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              query = query.in(key, value)
            } else if (typeof value === 'object' && 'from' in value && 'to' in value) {
              query = query.gte(key, (value as { from: number }).from).lte(key, (value as { to: number }).to)
            } else {
              query = query.eq(key, value)
            }
          }
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      if (options?.page !== undefined) {
        const pageSize = options.pageSize ?? this.defaultPageSize
        const from = options.page * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) return { data: [] as T[], total: 0, error: error.message }
      return { data: (data ?? []) as T[], total: count ?? 0 }
    } catch (e) {
      return { data: [] as T[], total: 0, error: (e as Error).message }
    }
  }

  async getById(id: string): Promise<{ data: T | null; error?: string }> {
    try {
      const { data, error } = await this.supabase.from(this.tableName).select('*').eq('id', id).single()
      if (error) return { data: null, error: error.message }
      return { data: data as T }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async create(item: Partial<T>): Promise<{ data: T | null; error?: string }> {
    try {
      const { data, error } = await this.supabase.from(this.tableName).insert(item as T).select().single()
      if (error) return { data: null, error: error.message }
      return { data: data as T }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async update(id: string, changes: Partial<T>): Promise<{ data: T | null; error?: string }> {
    try {
      const { data, error } = await this.supabase.from(this.tableName).update(changes as T).eq('id', id).select().single()
      if (error) return { data: null, error: error.message }
      return { data: data as T }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async delete(id: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.from(this.tableName).delete().eq('id', id)
      if (error) return { error: error.message }
      return {}
    } catch (e) {
      return { error: (e as Error).message }
    }
  }

  subscribe(
    callback: (event: RepositoryEvent<T>) => void,
    filter?: { column: string; value: string }
  ): { unsubscribe: () => void } {
    const channel = this.supabase
      .channel(`${this.tableName}-changes-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.tableName,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          callback({
            eventType: payload.eventType,
            new: payload.new as T | null,
            old: payload.old as T | null,
          })
        }
      )
      .subscribe()

    return {
      unsubscribe: () => {
        this.supabase.removeChannel(channel)
      },
    }
  }
}

export function wrapRepositoryCall<T>(fn: () => Promise<T>): Promise<{ data: T | null; error?: string }> {
  return fn()
    .then((d) => ({ data: d }))
    .catch((e) => ({ data: null, error: e.message }))
}
