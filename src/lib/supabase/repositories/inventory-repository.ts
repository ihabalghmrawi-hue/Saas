import { BaseRepository } from './base-repository'
import type { InventoryItem } from '@/lib/workbench/types'

export class InventoryItemRepository extends BaseRepository<InventoryItem> {
  constructor() {
    super('inventory_items')
  }

  async getByWarehouse(warehouseId: string): Promise<{ data: InventoryItem[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('warehouse', warehouseId)
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as InventoryItem[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getLowStock(): Promise<{ data: InventoryItem[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', 'low_stock')
        .order('onHand', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as InventoryItem[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByCategory(category: string): Promise<{ data: InventoryItem[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('category', category)
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as InventoryItem[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async adjustStock(id: string, quantity: number, reason: string): Promise<{ data: InventoryItem | null; error?: string }> {
    try {
      const { data: current, error: fetchError } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !current) return { data: null, error: fetchError?.message ?? 'Item not found' }

      const currentItem = current as unknown as InventoryItem
      const newOnHand = currentItem.onHand + quantity
      const newAvailable = currentItem.available + quantity
      const newTotalValue = newOnHand * currentItem.unitCost

      let newStatus: InventoryItem['status'] = 'in_stock'
      if (newOnHand <= 0) newStatus = 'out_of_stock'
      else if (newOnHand <= currentItem.reorderPoint) newStatus = 'low_stock'

      const { data: updated, error: updateError } = await this.supabase
        .from(this.tableName)
        .update({
          onHand: newOnHand,
          available: newAvailable,
          totalValue: newTotalValue,
          status: newStatus,
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) return { data: null, error: updateError.message }

      const movementError = await this.supabase.from('stock_movements').insert({
        itemId: id,
        quantity,
        type: 'adjustment',
        reason,
        beforeQuantity: currentItem.onHand,
        afterQuantity: newOnHand,
        created_at: Date.now(),
      })

      if (movementError.error) {
        return { data: updated as InventoryItem, error: `Stock updated but movement record failed: ${movementError.error.message}` }
      }

      return { data: updated as InventoryItem }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }
}

export class StockMovementRepository extends BaseRepository<any> {
  constructor() {
    super('stock_movements')
  }

  async getByItem(itemId: string): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('itemId', itemId)
        .order('created_at', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByWarehouse(warehouseId: string): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('warehouse', warehouseId)
        .order('created_at', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByDateRange(start: number, end: number): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export const inventoryItemsRepo = new InventoryItemRepository()
export const stockMovementsRepo = new StockMovementRepository()
