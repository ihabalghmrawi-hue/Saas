import { BaseRepository } from './base-repository'
import type { SalesOrder } from '@/lib/workbench/types'

export class SalesOrderRepository extends BaseRepository<SalesOrder> {
  constructor() {
    super('sales_orders')
  }

  async getByCustomer(customerId: string): Promise<{ data: SalesOrder[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('customer', customerId)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as SalesOrder[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getPending(): Promise<{ data: SalesOrder[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('status', ['pending', 'approved'])
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as SalesOrder[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByStatus(status: string): Promise<{ data: SalesOrder[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', status)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as SalesOrder[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async fulfillOrder(id: string): Promise<{ data: SalesOrder | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          status: 'shipped',
          shippedAt: Date.now(),
        } as Partial<SalesOrder>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error: error.message }
      return { data: data as SalesOrder }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }
}

export class CustomerRepository extends BaseRepository<any> {
  constructor() {
    super('customers')
  }

  async getActive(): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async search(query: string): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .or(`name.ilike.%${query}%,code.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getWithBalance(): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .gt('balance', 0)
        .order('balance', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export const salesOrdersRepo = new SalesOrderRepository()
export const customersRepo = new CustomerRepository()
