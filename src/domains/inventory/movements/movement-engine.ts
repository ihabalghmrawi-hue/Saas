import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryBatchRepository } from '../repositories/batch.repository'
import { InventoryValuationLayerRepository } from '../repositories/valuation.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import { InventoryEventBus } from '../events/event-bus'
import type { CreateMovementInput, MovementResult } from '../entities/movement.entity'
import type { ServiceResult, MovementType, MovementDirection } from '../types'

export class StockMovementEngine {
  private readonly movementRepo: StockMovementRepository
  private readonly batchRepo: InventoryBatchRepository
  private readonly valuationRepo: InventoryValuationLayerRepository
  private readonly itemRepo: InventoryItemRepository
  private readonly eventBus: InventoryEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.batchRepo = new InventoryBatchRepository(db, companyId)
    this.valuationRepo = new InventoryValuationLayerRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
    this.eventBus = InventoryEventBus.getInstance()
  }

  async receive(input: {
    item_id: string
    variant_id?: string
    batch_id?: string
    warehouse_id: string
    location_id?: string
    qty: number
    unit_cost: number
    total_cost?: number
    reference_type?: string
    reference_id?: string
    source: string
    source_id?: string
    description?: string
    created_by?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<MovementResult>> {
    try {
      if (input.qty <= 0) {
        return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر', code: 'INVALID_QTY' }
      }

      const totalCost = input.total_cost || (input.qty * input.unit_cost)

      const movement = await this.movementRepo.createMovement({
        item_id: input.item_id,
        variant_id: input.variant_id,
        batch_id: input.batch_id,
        warehouse_id: input.warehouse_id,
        location_id: input.location_id,
        movement_type: 'receipt',
        direction: 'in',
        qty: input.qty,
        unit_cost: input.unit_cost,
        total_cost: totalCost,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        source: input.source,
        source_id: input.source_id,
        description: input.description,
        created_by: input.created_by,
        metadata: input.metadata,
      })

      await this.valuationRepo.addLayer({
        item_id: input.item_id,
        variant_id: input.variant_id,
        batch_id: input.batch_id,
        warehouse_id: input.warehouse_id,
        layer_date: new Date().toISOString().slice(0, 10),
        qty_in: input.qty,
        qty_remaining: input.qty,
        unit_cost: input.unit_cost,
        total_cost_in: totalCost,
        total_cost_remaining: totalCost,
        movement_id: movement.id,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
      })

      if (input.batch_id) {
        await this.batchRepo.reduceAvailable(input.batch_id, 0)
      }

      this.eventBus.emit('inventory.received', {
        id: movement.id,
        type: 'receipt',
        companyId: this.companyId,
        itemId: input.item_id,
        warehouseId: input.warehouse_id,
        batchId: input.batch_id,
        movementId: movement.id,
        qty: input.qty,
        description: input.description || 'إستلام مخزون',
        reference: input.reference_id,
        sourceId: input.source_id,
        metadata: input.metadata,
        performedBy: input.created_by,
        timestamp: new Date().toISOString(),
      })

      return {
        ok: true,
        data: {
          movement_id: movement.id,
          item_id: input.item_id,
          qty: input.qty,
          unit_cost: input.unit_cost,
          total_cost: totalCost,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECEIPT_FAILED' }
    }
  }

  async issue(input: {
    item_id: string
    variant_id?: string
    batch_id?: string
    warehouse_id: string
    location_id?: string
    qty: number
    unit_cost?: number
    reference_type?: string
    reference_id?: string
    source: string
    source_id?: string
    description?: string
    created_by?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<MovementResult>> {
    try {
      if (input.qty <= 0) {
        return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر', code: 'INVALID_QTY' }
      }

      const currentStock = await this.movementRepo.getCurrentStock(input.item_id, input.warehouse_id)
      if (currentStock < input.qty) {
        return {
          ok: false,
          error: `الرصيد غير كاف. المتوفر: ${currentStock}، المطلوب: ${input.qty}`,
          code: 'INSUFFICIENT_STOCK',
        }
      }

      const item = await this.itemRepo.findById(input.item_id)
      const costMethod = item?.cost_method || 'weighted_average'

      let unitCost = input.unit_cost || 0
      let totalCost = 0

      if (costMethod === 'fifo') {
        const result = await this.valuationRepo.consumeFifo(input.item_id, input.warehouse_id, input.qty)
        totalCost = result.totalCost
        unitCost = totalCost / input.qty
      } else {
        unitCost = input.unit_cost || await this.valuationRepo.getWeightedAverageCost(input.item_id, input.warehouse_id)
        totalCost = unitCost * input.qty
      }

      const movement = await this.movementRepo.createMovement({
        item_id: input.item_id,
        variant_id: input.variant_id,
        batch_id: input.batch_id,
        warehouse_id: input.warehouse_id,
        location_id: input.location_id,
        movement_type: 'issue',
        direction: 'out',
        qty: input.qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        source: input.source,
        source_id: input.source_id,
        description: input.description,
        created_by: input.created_by,
        metadata: input.metadata,
      })

      if (costMethod !== 'fifo') {
        await this.valuationRepo.addLayer({
          item_id: input.item_id,
          variant_id: input.variant_id,
          batch_id: input.batch_id,
          warehouse_id: input.warehouse_id,
          layer_date: new Date().toISOString().slice(0, 10),
          qty_out: input.qty,
          qty_remaining: -input.qty,
          unit_cost: unitCost,
          total_cost_out: totalCost,
          movement_id: movement.id,
          reference_type: input.reference_type,
          reference_id: input.reference_id,
        })
      }

      this.eventBus.emit('inventory.issued', {
        id: movement.id,
        type: 'issue',
        companyId: this.companyId,
        itemId: input.item_id,
        warehouseId: input.warehouse_id,
        batchId: input.batch_id,
        movementId: movement.id,
        qty: input.qty,
        description: input.description || 'صرف مخزون',
        reference: input.reference_id,
        sourceId: input.source_id,
        metadata: { ...input.metadata, unit_cost: unitCost, total_cost: totalCost },
        performedBy: input.created_by,
        timestamp: new Date().toISOString(),
      })

      return {
        ok: true,
        data: {
          movement_id: movement.id,
          item_id: input.item_id,
          qty: input.qty,
          unit_cost: unitCost,
          total_cost: totalCost,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ISSUE_FAILED' }
    }
  }

  async adjust(input: {
    item_id: string
    variant_id?: string
    warehouse_id: string
    location_id?: string
    current_qty: number
    new_qty: number
    unit_cost?: number
    reason: string
    reference_type?: string
    reference_id?: string
    source: string
    source_id?: string
    description?: string
    created_by?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<MovementResult>> {
    try {
      const diff = input.new_qty - input.current_qty
      if (diff === 0) {
        return { ok: false, error: 'الكمية الجديدة مطابقة للكمية الحالية', code: 'NO_CHANGE' }
      }

      const movementType = diff > 0 ? 'adjustment_up' : 'adjustment_down'
      const direction: MovementDirection = diff > 0 ? 'in' : 'out'
      const absQty = Math.abs(diff)

      const item = await this.itemRepo.findById(input.item_id)
      const unitCost = input.unit_cost || item?.standard_cost || 0

      const movement = await this.movementRepo.createMovement({
        item_id: input.item_id,
        variant_id: input.variant_id,
        warehouse_id: input.warehouse_id,
        location_id: input.location_id,
        movement_type: movementType as MovementType,
        direction,
        qty: absQty,
        unit_cost: unitCost,
        total_cost: absQty * unitCost,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        source: input.source,
        source_id: input.source_id,
        description: input.description || input.reason,
        created_by: input.created_by,
        metadata: { ...input.metadata, reason: input.reason, current_qty: input.current_qty, new_qty: input.new_qty },
      })

      if (diff > 0) {
        await this.valuationRepo.addLayer({
          item_id: input.item_id,
          variant_id: input.variant_id,
          warehouse_id: input.warehouse_id,
          layer_date: new Date().toISOString().slice(0, 10),
          qty_in: absQty,
          qty_remaining: absQty,
          unit_cost: unitCost,
          total_cost_in: absQty * unitCost,
          total_cost_remaining: absQty * unitCost,
          movement_id: movement.id,
          reference_type: input.reference_type,
          reference_id: input.reference_id,
        })
      } else {
        await this.valuationRepo.addLayer({
          item_id: input.item_id,
          variant_id: input.variant_id,
          warehouse_id: input.warehouse_id,
          layer_date: new Date().toISOString().slice(0, 10),
          qty_out: absQty,
          qty_remaining: -absQty,
          unit_cost: unitCost,
          total_cost_out: absQty * unitCost,
          movement_id: movement.id,
          reference_type: input.reference_type,
          reference_id: input.reference_id,
        })
      }

      this.eventBus.emit('inventory.adjusted', {
        id: movement.id,
        type: movementType,
        companyId: this.companyId,
        itemId: input.item_id,
        warehouseId: input.warehouse_id,
        movementId: movement.id,
        qty: absQty,
        description: input.description || `تسوية مخزون: ${input.reason}`,
        reference: input.reference_id,
        sourceId: input.source_id,
        metadata: { reason: input.reason, current_qty: input.current_qty, new_qty: input.new_qty },
        performedBy: input.created_by,
        timestamp: new Date().toISOString(),
      })

      return {
        ok: true,
        data: {
          movement_id: movement.id,
          item_id: input.item_id,
          qty: absQty,
          unit_cost: unitCost,
          total_cost: absQty * unitCost,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ADJUSTMENT_FAILED' }
    }
  }

  async reverse(movementId: string, reason: string, createdBy?: string): Promise<ServiceResult<MovementResult>> {
    try {
      const movement = await this.movementRepo.reverse(movementId, reason, createdBy)
      return {
        ok: true,
        data: {
          movement_id: movement.id,
          item_id: movement.item_id,
          qty: movement.qty,
          unit_cost: movement.unit_cost,
          total_cost: movement.total_cost,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REVERSAL_FAILED' }
    }
  }

  async getCurrentStock(itemId: string, warehouseId?: string): Promise<number> {
    return this.movementRepo.getCurrentStock(itemId, warehouseId)
  }

  async getWarehouseBalances(warehouseId?: string) {
    return this.movementRepo.getWarehouseBalances(warehouseId)
  }

  async getHistory(filter: {
    item_id?: string
    warehouse_id?: string
    from_date?: string
    to_date?: string
    limit?: number
  }) {
    return this.movementRepo.getHistory(filter)
  }
}
