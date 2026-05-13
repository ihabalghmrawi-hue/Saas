import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryReservationRepository, InventoryAllocationRepository } from '../repositories/reservation.repository'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryEventBus } from '../events/event-bus'
import type { InventoryReservationEntity, InventoryAllocationEntity, ReservationSummary } from '../entities/reservation.entity'
import type { ServiceResult } from '../types'

export class ReservationEngine {
  private readonly reservationRepo: InventoryReservationRepository
  private readonly allocationRepo: InventoryAllocationRepository
  private readonly movementRepo: StockMovementRepository
  private readonly eventBus: InventoryEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.reservationRepo = new InventoryReservationRepository(db, companyId)
    this.allocationRepo = new InventoryAllocationRepository(db, companyId)
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.eventBus = InventoryEventBus.getInstance()
  }

  async reserve(input: {
    item_id: string
    variant_id?: string
    batch_id?: string
    warehouse_id: string
    location_id?: string
    order_id?: string
    order_type?: string
    order_line_id?: string
    qty: number
    type?: string
    expires_at?: string
    created_by?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<InventoryReservationEntity>> {
    try {
      if (input.qty <= 0) {
        return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر', code: 'INVALID_QTY' }
      }

      const available = await this.movementRepo.getCurrentStock(input.item_id, input.warehouse_id)
      const reserved = await this.reservationRepo.getTotalReserved(input.item_id, input.warehouse_id)
      const netAvailable = available - reserved

      if (netAvailable < input.qty && input.type !== 'backorder') {
        return {
          ok: false,
          error: `الرصيد المتاح غير كاف. المتوفر: ${netAvailable}، المطلوب: ${input.qty}`,
          code: 'INSUFFICIENT_AVAILABLE',
        }
      }

      const reservationType = input.type || (netAvailable >= input.qty ? 'soft' : 'backorder')

      const reservation = await this.reservationRepo.createReservation({
        ...input,
        type: reservationType,
      })

      this.eventBus.emit('inventory.reserved', {
        id: reservation.id,
        type: reservationType,
        companyId: this.companyId,
        itemId: input.item_id,
        warehouseId: input.warehouse_id,
        qty: input.qty,
        description: `حجز ${reservationType === 'backorder' ? 'مؤجل' : ''}: ${input.qty} من ${input.item_id}`,
        reference: input.order_id,
        sourceId: input.order_line_id,
        metadata: { order_type: input.order_type, reservation_type: reservationType },
        performedBy: input.created_by,
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: reservation }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RESERVE_FAILED' }
    }
  }

  async release(reservationId: string): Promise<ServiceResult<void>> {
    try {
      await this.reservationRepo.cancel(reservationId)

      this.eventBus.emit('inventory.unreserved', {
        id: reservationId,
        type: 'unreservation',
        companyId: this.companyId,
        qty: 0,
        description: 'إلغاء حجز مخزون',
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RELEASE_FAILED' }
    }
  }

  async allocate(input: {
    reservation_id?: string
    item_id: string
    batch_id?: string
    warehouse_id: string
    location_id?: string
    picker_id?: string
    order_line_id?: string
    qty: number
  }): Promise<ServiceResult<InventoryAllocationEntity>> {
    try {
      const allocation = await this.allocationRepo.create(input as any)

      this.eventBus.emit('inventory.allocated', {
        id: allocation.id,
        type: 'allocation',
        companyId: this.companyId,
        itemId: input.item_id,
        warehouseId: input.warehouse_id,
        qty: input.qty,
        description: `تخصيص مخزون: ${input.qty}`,
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: allocation }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ALLOCATE_FAILED' }
    }
  }

  async getReservationSummary(itemId: string, warehouseId?: string): Promise<ServiceResult<ReservationSummary>> {
    try {
      const reservations = await this.reservationRepo.findActiveByItem(itemId, warehouseId)
      const totalReserved = reservations.reduce((s, r) => s + (r.qty - r.qty_delivered - r.qty_cancelled), 0)
      const totalAvailable = await this.movementRepo.getCurrentStock(itemId, warehouseId)

      return {
        ok: true,
        data: {
          total_reserved: totalReserved,
          total_available: totalAvailable,
          reservations,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SUMMARY_FAILED' }
    }
  }

  async expireOverdue(): Promise<ServiceResult<number>> {
    try {
      const count = await this.reservationRepo.expireOverdue()
      return { ok: true, data: count }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'EXPIRE_FAILED' }
    }
  }
}
