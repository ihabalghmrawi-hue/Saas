import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import { InventoryValuationLayerRepository, InventorySnapshotRepository } from '../repositories/valuation.repository'
import { InventoryBatchRepository } from '../repositories/batch.repository'
import { InventoryReservationRepository } from '../repositories/reservation.repository'
import type { ServiceResult } from '../types'

export interface StockValuationReport {
  generated_at: string
  total_items: number
  total_qty: number
  total_value: number
  items: Array<{
    item_id: string
    code: string
    name: string
    cost_method: string
    qty: number
    unit_cost: number
    total_value: number
  }>
}

export interface InventoryAgingReport {
  generated_at: string
  total_value: number
  buckets: Record<string, { total: number; count: number; items: any[] }>
}

export interface TurnoverReport {
  generated_at: string
  period_from: string
  period_to: string
  items: Array<{
    item_id: string
    item_code: string
    item_name: string
    avg_stock: number
    total_issues: number
    turnover_ratio: number
  }>
}

export interface LowStockReport {
  generated_at: string
  items: Array<{
    item_id: string
    code: string
    name: string
    current_qty: number
    reorder_point: number
    min_stock: number
    max_stock: number
    reorder_qty: number
    shortfall: number
  }>
}

export class InventoryReportGenerator {
  private readonly movementRepo: StockMovementRepository
  private readonly itemRepo: InventoryItemRepository
  private readonly layerRepo: InventoryValuationLayerRepository
  private readonly snapshotRepo: InventorySnapshotRepository
  private readonly batchRepo: InventoryBatchRepository
  private readonly reservationRepo: InventoryReservationRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
    this.layerRepo = new InventoryValuationLayerRepository(db, companyId)
    this.snapshotRepo = new InventorySnapshotRepository(db, companyId)
    this.batchRepo = new InventoryBatchRepository(db, companyId)
    this.reservationRepo = new InventoryReservationRepository(db, companyId)
  }

  async generateStockValuation(warehouseId?: string): Promise<ServiceResult<StockValuationReport>> {
    try {
      const balances = await this.movementRepo.getWarehouseBalances(warehouseId)
      const items = await this.itemRepo.findAllActive()
      const itemMap = new Map(items.map(i => [i.id, i]))

      const reportItems = balances.map(b => {
        const item = itemMap.get(b.item_id)
        return {
          item_id: b.item_id,
          code: item?.code || '',
          name: item?.name || '',
          cost_method: item?.cost_method || 'weighted_average',
          qty: b.current_qty,
          unit_cost: b.unit_cost,
          total_value: b.total_value,
        }
      })

      return {
        ok: true,
        data: {
          generated_at: new Date().toISOString(),
          total_items: reportItems.length,
          total_qty: reportItems.reduce((s, i) => s + i.qty, 0),
          total_value: reportItems.reduce((s, i) => s + i.total_value, 0),
          items: reportItems,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'VALUATION_REPORT_FAILED' }
    }
  }

  async generateAgingReport(asOfDate?: string): Promise<ServiceResult<InventoryAgingReport>> {
    try {
      const date = asOfDate || new Date().toISOString().slice(0, 10)
      const { data, error } = await this.db.rpc('get_inventory_aging', {
        p_company_id: this.companyId,
        p_as_of_date: date,
      })

      if (error) throw error

      const rows: Array<{ aging_bucket: string; total_value: number }> = data || []
      const buckets: Record<string, { total: number; count: number; items: any[] }> = {
        '0-30': { total: 0, count: 0, items: [] },
        '31-60': { total: 0, count: 0, items: [] },
        '61-90': { total: 0, count: 0, items: [] },
        '90+': { total: 0, count: 0, items: [] },
      }

      for (const row of rows) {
        const bucket = row.aging_bucket || '90+'
        if (!buckets[bucket]) buckets[bucket] = { total: 0, count: 0, items: [] }
        buckets[bucket].total += Number(row.total_value || 0)
        buckets[bucket].count++
        buckets[bucket].items.push(row)
      }

      const totalValue = Object.values(buckets).reduce((s, b) => s + b.total, 0)

      return {
        ok: true,
        data: {
          generated_at: new Date().toISOString(),
          total_value: totalValue,
          buckets,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'AGING_REPORT_FAILED' }
    }
  }

  async generateTurnoverReport(fromDate: string, toDate: string): Promise<ServiceResult<TurnoverReport>> {
    try {
      const { data, error } = await this.db.rpc('get_inventory_turnover', {
        p_company_id: this.companyId,
        p_from_date: fromDate,
        p_to_date: toDate,
      })

      if (error) throw error

      return {
        ok: true,
        data: {
          generated_at: new Date().toISOString(),
          period_from: fromDate,
          period_to: toDate,
          items: (data || []) as TurnoverReport['items'],
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TURNOVER_REPORT_FAILED' }
    }
  }

  async generateLowStockReport(): Promise<ServiceResult<LowStockReport>> {
    try {
      const balances = await this.movementRepo.getWarehouseBalances()
      const items = await this.itemRepo.findAllActive()
      const itemMap = new Map(items.map(i => [i.id, i]))

      const lowStockItems = balances
        .map(b => {
          const item = itemMap.get(b.item_id)
          if (!item) return null
          const shortfall = Math.max(0, (item.reorder_point || 0) - b.current_qty)
          if (shortfall <= 0 && b.current_qty >= (item.min_stock || 0)) return null
          return {
            item_id: b.item_id,
            code: item.code,
            name: item.name,
            current_qty: b.current_qty,
            reorder_point: item.reorder_point || 0,
            min_stock: item.min_stock || 0,
            max_stock: item.max_stock || 0,
            reorder_qty: item.reorder_qty || 0,
            shortfall,
          }
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) => b.shortfall - a.shortfall)

      return {
        ok: true,
        data: {
          generated_at: new Date().toISOString(),
          items: lowStockItems,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LOW_STOCK_REPORT_FAILED' }
    }
  }

  async generateMovementReport(filter: {
    item_id?: string
    warehouse_id?: string
    from_date?: string
    to_date?: string
    limit?: number
  }) {
    return this.movementRepo.getHistory(filter)
  }
}
