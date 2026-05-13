import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementEngine } from '../movements/movement-engine'
import { InventoryBatchRepository } from '../repositories/batch.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import type { ServiceResult } from '../types'

export class ReceivingWorkflow {
  private readonly movementEngine: StockMovementEngine
  private readonly batchRepo: InventoryBatchRepository
  private readonly itemRepo: InventoryItemRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementEngine = new StockMovementEngine(db, companyId)
    this.batchRepo = new InventoryBatchRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
  }

  async receiveWithBatch(input: {
    item_id: string
    variant_id?: string
    warehouse_id: string
    location_id?: string
    qty: number
    unit_cost: number
    batch_no: string
    supplier_batch?: string
    manufacturing_date?: string
    expiry_date?: string
    reference_type?: string
    reference_id?: string
    source: string
    source_id?: string
    description?: string
    created_by?: string
  }): Promise<ServiceResult<{ movement_id: string; batch_id: string }>> {
    try {
      const item = await this.itemRepo.findById(input.item_id)
      if (!item) return { ok: false, error: 'الصنف غير موجود', code: 'ITEM_NOT_FOUND' }

      const batch = await this.batchRepo.createBatch({
        item_id: input.item_id,
        variant_id: input.variant_id,
        batch_no: input.batch_no,
        supplier_batch: input.supplier_batch,
        manufacturing_date: input.manufacturing_date,
        expiry_date: input.expiry_date,
        initial_qty: input.qty,
        unit_cost: input.unit_cost,
        warehouse_id: input.warehouse_id,
        location_id: input.location_id,
      })

      const movement = await this.movementEngine.receive({
        ...input,
        batch_id: batch.id,
        metadata: { batch_no: input.batch_no },
      })

      if (!movement.ok) return movement

      return {
        ok: true,
        data: {
          movement_id: movement.data.movement_id,
          batch_id: batch.id,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECEIVE_BATCH_FAILED' }
    }
  }
}
