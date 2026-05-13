import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryValuationLayerRepository, InventorySnapshotRepository } from '../repositories/valuation.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import { StockMovementRepository } from '../repositories/movement.repository'
import type { ValuationSummary } from '../entities/valuation.entity'
import type { ServiceResult } from '../types'

export class ValuationEngine {
  private readonly layerRepo: InventoryValuationLayerRepository
  private readonly snapshotRepo: InventorySnapshotRepository
  private readonly itemRepo: InventoryItemRepository
  private readonly movementRepo: StockMovementRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.layerRepo = new InventoryValuationLayerRepository(db, companyId)
    this.snapshotRepo = new InventorySnapshotRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
    this.movementRepo = new StockMovementRepository(db, companyId)
  }

  async getItemValuation(itemId: string, warehouseId: string): Promise<ServiceResult<ValuationSummary>> {
    try {
      const item = await this.itemRepo.findById(itemId)
      if (!item) return { ok: false, error: 'الصنف غير موجود', code: 'ITEM_NOT_FOUND' }

      const layers = await this.layerRepo.findActiveLayers(itemId, warehouseId)
      const totalQty = layers.reduce((s, l) => s + l.qty_remaining, 0)
      const totalValue = layers.reduce((s, l) => s + l.total_cost_remaining, 0)

      return {
        ok: true,
        data: {
          item_id: itemId,
          item_code: item.code,
          item_name: item.name,
          cost_method: item.cost_method,
          total_qty: totalQty,
          total_value: totalValue,
          weighted_avg_cost: totalQty > 0 ? totalValue / totalQty : 0,
          layers,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'VALUATION_FAILED' }
    }
  }

  async getWeightedAverageCost(itemId: string, warehouseId: string): Promise<number> {
    return this.layerRepo.getWeightedAverageCost(itemId, warehouseId)
  }

  async recalculateAllValuations(): Promise<ServiceResult<{ itemsUpdated: number }>> {
    try {
      const items = await this.itemRepo.findAllActive()
      let updated = 0

      for (const item of items) {
        const movements = await this.movementRepo.findMany({
          filters: { item_id: item.id },
          orderBy: 'posted_at',
        })

        const inMovements = movements.filter(m => m.direction === 'in' && !m.is_reversed)
        const outMovements = movements.filter(m => m.direction === 'out' && !m.is_reversed)

        const totalInQty = inMovements.reduce((s, m) => s + m.qty, 0)
        const totalInCost = inMovements.reduce((s, m) => s + m.total_cost, 0)
        const totalOutQty = outMovements.reduce((s, m) => s + m.qty, 0)
        const totalOutCost = outMovements.reduce((s, m) => s + m.total_cost, 0)

        const remainingQty = totalInQty - totalOutQty
        const remainingCost = totalInCost - totalOutCost

        if (remainingQty > 0 && item.default_warehouse_id) {
          const existingLayers = await this.layerRepo.findActiveLayers(item.id, item.default_warehouse_id)
          if (existingLayers.length === 0 && remainingQty > 0) {
            await this.layerRepo.addLayer({
              item_id: item.id,
              warehouse_id: item.default_warehouse_id,
              layer_date: new Date().toISOString().slice(0, 10),
              qty_in: remainingQty,
              qty_remaining: remainingQty,
              unit_cost: remainingCost / remainingQty,
              total_cost_in: remainingCost,
              total_cost_remaining: remainingCost,
              reference_type: 'recalculation',
            })
            updated++
          }
        }
      }

      return { ok: true, data: { itemsUpdated: updated } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECALC_FAILED' }
    }
  }

  async getInventoryValue(warehouseId?: string): Promise<ServiceResult<{
    total_qty: number
    total_value: number
    items: Array<{ item_id: string; item_code: string; item_name: string; qty: number; value: number }>
  }>> {
    try {
      const balances = await this.movementRepo.getWarehouseBalances(warehouseId)
      const totalQty = balances.reduce((s, b) => s + b.current_qty, 0)
      const totalValue = balances.reduce((s, b) => s + b.total_value, 0)

      return {
        ok: true,
        data: {
          total_qty: totalQty,
          total_value: totalValue,
          items: balances.map(b => ({
            item_id: b.item_id,
            item_code: '',
            item_name: '',
            qty: b.current_qty,
            value: b.total_value,
          })),
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'INV_VALUE_FAILED' }
    }
  }

  async generateSnapshot(warehouseId?: string): Promise<ServiceResult<{ count: number }>> {
    try {
      const count = await this.snapshotRepo.generateDailySnapshot(warehouseId)
      return { ok: true, data: { count } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SNAPSHOT_FAILED' }
    }
  }
}
