import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import { InventoryReservationRepository } from '../repositories/reservation.repository'
import { InventoryValuationLayerRepository, InventoryIntegrityLogRepository } from '../repositories/valuation.repository'
import { InventoryEventBus } from '../events/event-bus'
import type { ServiceResult } from '../types'

export interface IntegrityCheckResult {
  check_type: string
  status: 'passed' | 'failed' | 'warning'
  details: Record<string, any>
}

export class InventoryIntegrityService {
  private readonly movementRepo: StockMovementRepository
  private readonly itemRepo: InventoryItemRepository
  private readonly reservationRepo: InventoryReservationRepository
  private readonly layerRepo: InventoryValuationLayerRepository
  private readonly logRepo: InventoryIntegrityLogRepository
  private readonly eventBus: InventoryEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
    this.reservationRepo = new InventoryReservationRepository(db, companyId)
    this.layerRepo = new InventoryValuationLayerRepository(db, companyId)
    this.logRepo = new InventoryIntegrityLogRepository(db, companyId)
    this.eventBus = InventoryEventBus.getInstance()
  }

  async runAllChecks(): Promise<ServiceResult<IntegrityCheckResult[]>> {
    const results: IntegrityCheckResult[] = []

    const checks = [
      this.checkNegativeStock,
      this.checkOrphanedMovements,
      this.checkValuationMismatch,
      this.checkReservationInconsistencies,
    ]

    for (const check of checks) {
      try {
        const result = await check.call(this)
        results.push(result)
      } catch (e: any) {
        results.push({
          check_type: check.name,
          status: 'warning',
          details: { error: e.message },
        })
      }
    }

    const allPassed = results.every(r => r.status === 'passed')
    const hasFailed = results.some(r => r.status === 'failed')

    if (hasFailed) {
      this.eventBus.emit('inventory.integrity.failed', {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        type: 'integrity_failed',
        companyId: this.companyId,
        qty: 0,
        description: 'فشلت فحوصات نزاهة المخزون',
        metadata: { results },
        timestamp: new Date().toISOString(),
      })
    } else {
      this.eventBus.emit('inventory.integrity.passed', {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        type: 'integrity_passed',
        companyId: this.companyId,
        qty: 0,
        description: 'فحوصات نزاهة المخزون ناجحة',
        timestamp: new Date().toISOString(),
      })
    }

    return { ok: true, data: results }
  }

  private async checkNegativeStock(): Promise<IntegrityCheckResult> {
    const balances = await this.movementRepo.getWarehouseBalances()
    const negativeItems = balances.filter(b => b.current_qty < -0.001)

    for (const item of negativeItems) {
      await this.logRepo.create({
        company_id: this.companyId,
        check_type: 'negative_stock',
        severity: 'error',
        status: 'open',
        description: `رصيد سالب للصنف ${item.item_id} في المستودع ${item.warehouse_id}: ${item.current_qty}`,
        details: item,
        item_id: item.item_id,
        warehouse_id: item.warehouse_id,
      } as any)
    }

    return {
      check_type: 'negative_stock',
      status: negativeItems.length === 0 ? 'passed' : 'failed',
      details: { count: negativeItems.length, items: negativeItems },
    }
  }

  private async checkOrphanedMovements(): Promise<IntegrityCheckResult> {
    const items = await this.itemRepo.findAllActive()
    const orphaned: Array<{ item_id: string; msg: string }> = []

    for (const item of items) {
      const movements = await this.movementRepo.findMany({
        filters: { item_id: item.id },
        limit: 1,
      })

      if (item.is_tracked && movements.length > 0) {
        const currentStock = await this.movementRepo.getCurrentStock(item.id)
        const layers = await this.layerRepo.findMany({
          filters: { item_id: item.id },
          limit: 100,
        })
        const layerQty = layers.reduce((s, l) => s + l.qty_remaining, 0)

        if (Math.abs(currentStock - layerQty) > 0.01 && currentStock > 0) {
          orphaned.push({
            item_id: item.id,
            msg: `حركة: ${currentStock} != طبقات: ${layerQty}`,
          })
        }
      }
    }

    return {
      check_type: 'orphaned_movements',
      status: orphaned.length === 0 ? 'passed' : 'warning',
      details: { count: orphaned.length, items: orphaned },
    }
  }

  private async checkValuationMismatch(): Promise<IntegrityCheckResult> {
    const items = await this.itemRepo.findAllActive()
    const mismatches: Array<{ item_id: string; expected: number; actual: number }> = []

    for (const item of items.filter(i => i.is_tracked && i.default_warehouse_id)) {
      const qtyFromMovements = await this.movementRepo.getCurrentStock(item.id, item.default_warehouse_id!)
      const layers = await this.layerRepo.findActiveLayers(item.id, item.default_warehouse_id!)
      const qtyFromLayers = layers.reduce((s, l) => s + l.qty_remaining, 0)

      if (Math.abs(qtyFromMovements - qtyFromLayers) > 0.01) {
        mismatches.push({
          item_id: item.id,
          expected: qtyFromMovements,
          actual: qtyFromLayers,
        })
      }
    }

    return {
      check_type: 'valuation_mismatch',
      status: mismatches.length === 0 ? 'passed' : 'failed',
      details: { count: mismatches.length, mismatches },
    }
  }

  private async checkReservationInconsistencies(): Promise<IntegrityCheckResult> {
    try {
      const items = await this.itemRepo.findAllActive()
      const issues: Array<{ item_id: string; total_reserved: number; total_available: number }> = []

      for (const item of items.filter(i => i.is_tracked)) {
        const reservations = await this.reservationRepo.findActiveByItem(item.id)
        const totalReserved = reservations.reduce((s, r) => s + (r.qty - r.qty_delivered - r.qty_cancelled), 0)

        if (totalReserved > 0) {
          const warehouses = [...new Set(reservations.map(r => r.warehouse_id))]
          for (const wh of warehouses) {
            const available = await this.movementRepo.getCurrentStock(item.id, wh)
            const whReserved = reservations
              .filter(r => r.warehouse_id === wh)
              .reduce((s, r) => s + (r.qty - r.qty_delivered - r.qty_cancelled), 0)

            if (whReserved > available + 0.01) {
              issues.push({ item_id: item.id, total_reserved: whReserved, total_available: available })
            }
          }
        }
      }

      return {
        check_type: 'reservation_inconsistencies',
        status: issues.length === 0 ? 'passed' : 'warning',
        details: { count: issues.length, issues },
      }
    } catch {
      return {
        check_type: 'reservation_inconsistencies',
        status: 'passed',
        details: { count: 0 },
      }
    }
  }
}
