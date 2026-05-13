import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryTransferRepository, TransferLineRepository } from '../repositories/transfer.repository'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryEventBus } from '../events/event-bus'
import type { InventoryTransferEntity, TransferLineEntity, CreateTransferInput } from '../entities/transfer.entity'
import type { ServiceResult } from '../types'

export class TransferEngine {
  private readonly transferRepo: InventoryTransferRepository
  private readonly lineRepo: TransferLineRepository
  private readonly movementRepo: StockMovementRepository
  private readonly eventBus: InventoryEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.transferRepo = new InventoryTransferRepository(db, companyId)
    this.lineRepo = new TransferLineRepository(db, companyId)
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.eventBus = InventoryEventBus.getInstance()
  }

  async create(input: CreateTransferInput): Promise<ServiceResult<InventoryTransferEntity>> {
    try {
      if (input.from_warehouse_id === input.to_warehouse_id) {
        return { ok: false, error: 'لا يمكن التحويل لنفس المستودع', code: 'SAME_WAREHOUSE' }
      }

      const transferNo = await this.transferRepo.generateTransferNo()

      const transfer = await this.transferRepo.create({
        transfer_no: transferNo,
        from_warehouse_id: input.from_warehouse_id,
        to_warehouse_id: input.to_warehouse_id,
        from_branch_id: input.from_branch_id,
        to_branch_id: input.to_branch_id,
        type: input.type || 'internal',
        status: 'draft',
        requested_by: input.requested_by,
        notes: input.notes,
        notes_ar: input.notes_ar,
        expected_delivery_date: input.expected_delivery_date,
        metadata: input.metadata,
      } as any)

      const lines = input.lines.map(l => ({
        transfer_id: transfer.id,
        company_id: this.companyId,
        item_id: l.item_id,
        variant_id: l.variant_id,
        batch_id: l.batch_id,
        from_location_id: l.from_location_id,
        to_location_id: l.to_location_id,
        qty: l.qty,
        qty_received: 0,
        unit_cost: 0,
        total_cost: 0,
        notes: l.notes,
      }))

      await this.lineRepo.createBatch(lines as any[])

      return { ok: true, data: transfer }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TRANSFER_CREATE_FAILED' }
    }
  }

  async approve(transferId: string, approvedBy?: string): Promise<ServiceResult<InventoryTransferEntity>> {
    try {
      const transfer = await this.transferRepo.findById(transferId)
      if (!transfer) return { ok: false, error: 'التحويل غير موجود', code: 'NOT_FOUND' }
      if (transfer.status !== 'draft') return { ok: false, error: 'يمكن اعتماد المسودات فقط', code: 'INVALID_STATUS' }

      const lines = await this.lineRepo.findByTransfer(transferId)
      for (const line of lines) {
        const available = await this.movementRepo.getCurrentStock(line.item_id, transfer.from_warehouse_id)
        if (available < line.qty) {
          return {
            ok: false,
            error: `الرصيد غير كاف للصنف ${line.item_id}. المتوفر: ${available}`,
            code: 'INSUFFICIENT_STOCK',
          }
        }
      }

      const updated = await this.transferRepo.update(transferId, { status: 'approved', approved_by: approvedBy } as any)

      for (const line of lines) {
        const unitCost = line.unit_cost || 0
        const totalCost = line.qty * unitCost

        await this.movementRepo.createMovement({
          item_id: line.item_id,
          variant_id: line.variant_id,
          batch_id: line.batch_id,
          warehouse_id: transfer.from_warehouse_id,
          location_id: line.from_location_id,
          movement_type: 'transfer_out',
          direction: 'out',
          qty: line.qty,
          unit_cost: unitCost,
          total_cost: totalCost,
          reference_type: 'transfer',
          reference_id: transferId,
          reference_line_id: line.id,
          source: 'transfer',
          source_id: transferId,
          description: `تحويل ${transfer.transfer_no}: صرف من مستودع المصدر`,
          created_by: approvedBy,
          metadata: { to_warehouse_id: transfer.to_warehouse_id, transfer_no: transfer.transfer_no },
        })

        await this.movementRepo.createMovement({
          item_id: line.item_id,
          variant_id: line.variant_id,
          batch_id: line.batch_id,
          warehouse_id: transfer.to_warehouse_id,
          location_id: line.to_location_id,
          movement_type: 'transfer_in',
          direction: 'in',
          qty: line.qty,
          unit_cost: unitCost,
          total_cost: totalCost,
          reference_type: 'transfer',
          reference_id: transferId,
          reference_line_id: line.id,
          source: 'transfer',
          source_id: `${transferId}-in`,
          description: `تحويل ${transfer.transfer_no}: إستلام في مستودع الوجهة`,
          created_by: approvedBy,
          metadata: { from_warehouse_id: transfer.from_warehouse_id, transfer_no: transfer.transfer_no },
        })

        await this.lineRepo.update(line.id, {
          unit_cost: unitCost,
          total_cost: totalCost,
        } as any)
      }

      const receivedTransfer = await this.transferRepo.update(transferId, {
        status: 'completed',
        received_by: approvedBy,
        received_date: new Date().toISOString(),
      } as any)

      this.eventBus.emit('inventory.transferred', {
        id: transferId,
        type: 'transfer',
        companyId: this.companyId,
        transferId,
        qty: lines.reduce((s, l) => s + l.qty, 0),
        description: `تحويل مخزون: ${transfer.transfer_no}`,
        reference: transfer.transfer_no,
        metadata: { from_warehouse_id: transfer.from_warehouse_id, to_warehouse_id: transfer.to_warehouse_id, line_count: lines.length },
        performedBy: approvedBy,
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'APPROVE_FAILED' }
    }
  }

  async receive(transferId: string, receivedBy?: string): Promise<ServiceResult<InventoryTransferEntity>> {
    try {
      const transfer = await this.transferRepo.findById(transferId)
      if (!transfer) return { ok: false, error: 'التحويل غير موجود', code: 'NOT_FOUND' }

      const lines = await this.lineRepo.findByTransfer(transferId)

      for (const line of lines) {
        const qtyToReceive = line.qty - line.qty_received
        if (qtyToReceive <= 0) continue

        await this.lineRepo.update(line.id, { qty_received: line.qty } as any)
      }

      const updated = await this.transferRepo.update(transferId, {
        status: 'received',
        received_by: receivedBy,
        received_date: new Date().toISOString(),
      } as any)

      this.eventBus.emit('inventory.transfer.received', {
        id: transferId,
        type: 'transfer_received',
        companyId: this.companyId,
        transferId,
        qty: lines.reduce((s, l) => s + l.qty, 0),
        description: `إستلام تحويل: ${transfer.transfer_no}`,
        reference: transfer.transfer_no,
        performedBy: receivedBy,
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECEIVE_TRANSFER_FAILED' }
    }
  }

  async cancel(transferId: string, reason?: string): Promise<ServiceResult<InventoryTransferEntity>> {
    try {
      const updated = await this.transferRepo.update(transferId, {
        status: 'cancelled',
        notes: reason,
      } as any)
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CANCEL_FAILED' }
    }
  }
}
