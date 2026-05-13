import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementEngine } from '../../inventory/movements/movement-engine'
import { InventoryItemRepository } from '../../inventory/repositories/item.repository'
import { InventoryReservationRepository } from '../../inventory/repositories/reservation.repository'
import { ValuationEngine } from '../../inventory/valuations/valuation-engine'
import type { ServiceResult } from '../types'

export class InventoryOrchestrator {
  private readonly movementEngine: StockMovementEngine
  private readonly itemRepo: InventoryItemRepository
  private readonly reservationRepo: InventoryReservationRepository
  private readonly valuationEngine: ValuationEngine

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementEngine = new StockMovementEngine(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
    this.reservationRepo = new InventoryReservationRepository(db, companyId)
    this.valuationEngine = new ValuationEngine(db, companyId)
  }

  async reserveForInvoice(invoiceId: string, lines: Array<{ item_id: string; warehouse_id: string; qty: number }>): Promise<ServiceResult<void>> {
    try {
      for (const line of lines) {
        await this.reservationRepo.create({
          item_id: line.item_id, warehouse_id: line.warehouse_id,
          qty: line.qty, type: 'hard', order_id: invoiceId, order_type: 'invoice',
        } as any)
      }
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RESERVE_FAILED' }
    }
  }

  async issueForInvoice(invoiceId: string, lines: Array<{ item_id: string; warehouse_id: string; qty: number; unit_cost?: number; description?: string }>): Promise<ServiceResult<void>> {
    try {
      for (const line of lines) {
        const item = await this.itemRepo.findById(line.item_id)
        const unitCost = line.unit_cost || item?.standard_cost || 0

        await this.movementEngine.issue({
          item_id: line.item_id, warehouse_id: line.warehouse_id, qty: line.qty,
          unit_cost: unitCost, reference_type: 'invoice', reference_id: invoiceId,
          source: 'sales_invoice', source_id: invoiceId,
          description: line.description || `صرف فاتورة ${invoiceId}`,
        })
      }
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ISSUE_FAILED' }
    }
  }

  async receiveReturn(invoiceId: string, lines: Array<{ item_id: string; warehouse_id: string; qty: number; unit_cost?: number }>): Promise<ServiceResult<void>> {
    try {
      for (const line of lines) {
        await this.movementEngine.receive({
          item_id: line.item_id, warehouse_id: line.warehouse_id, qty: line.qty,
          unit_cost: line.unit_cost || 0, reference_type: 'return', reference_id: invoiceId,
          source: 'sales_return', source_id: invoiceId,
          description: `إستلام مرتجع فاتورة ${invoiceId}`,
        })
      }
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECEIVE_RETURN_FAILED' }
    }
  }
}
