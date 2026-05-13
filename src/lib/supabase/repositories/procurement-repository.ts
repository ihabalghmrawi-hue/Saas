import { BaseRepository } from './base-repository'
import type { PurchaseOrder } from '@/lib/workbench/types'

export class PurchaseOrderRepository extends BaseRepository<PurchaseOrder> {
  constructor() {
    super('purchase_orders')
  }

  async getBySupplier(supplierId: string): Promise<{ data: PurchaseOrder[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('supplier', supplierId)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PurchaseOrder[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getPending(): Promise<{ data: PurchaseOrder[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('status', ['pending', 'approved'])
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PurchaseOrder[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByStatus(status: string): Promise<{ data: PurchaseOrder[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', status)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PurchaseOrder[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async approvePO(id: string, approvedBy: string): Promise<{ data: PurchaseOrder | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          status: 'approved',
          approvedBy,
          approvedAt: Date.now(),
        } as Partial<PurchaseOrder>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error: error.message }
      return { data: data as PurchaseOrder }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async receivePO(id: string, items: Array<{ itemId: string; quantity: number }>): Promise<{ data: PurchaseOrder | null; error?: string }> {
    try {
      const { data: current, error: fetchError } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !current) return { data: null, error: fetchError?.message ?? 'Purchase order not found' }

      const po = current as unknown as PurchaseOrder
      const updatedItems = po.items.map((line) => {
        const receipt = items.find((r) => r.itemId === line.id)
        if (receipt) {
          return { ...line, received: Math.min(line.received + receipt.quantity, line.quantity) }
        }
        return line
      })

      const allReceived = updatedItems.every((line) => line.received >= line.quantity)
      const newStatus: PurchaseOrder['status'] = allReceived ? 'received' : 'approved'

      const { data: updated, error: updateError } = await this.supabase
        .from(this.tableName)
        .update({
          items: updatedItems,
          status: newStatus,
        } as Partial<PurchaseOrder>)
        .eq('id', id)
        .select()
        .single()

      if (updateError) return { data: null, error: updateError.message }
      return { data: updated as PurchaseOrder }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }
}

export class SupplierRepository extends BaseRepository<any> {
  constructor() {
    super('suppliers')
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
}

export const purchaseOrdersRepo = new PurchaseOrderRepository()
export const suppliersRepo = new SupplierRepository()
