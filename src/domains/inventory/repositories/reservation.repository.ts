import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository, RepositoryError } from './base'
import type { InventoryReservationEntity, InventoryAllocationEntity, CreateReservationInput } from '../entities/reservation.entity'

export class InventoryReservationRepository extends BaseInventoryRepository<InventoryReservationEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_reservations')
  }

  async createReservation(input: CreateReservationInput): Promise<InventoryReservationEntity> {
    const { data, error } = await this.db
      .from('inventory_reservations')
      .insert({ company_id: this.companyId, ...input })
      .select('*')
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as InventoryReservationEntity
  }

  async findByOrder(orderId: string, orderType: string): Promise<InventoryReservationEntity[]> {
    return this.findMany({ filters: { order_id: orderId, order_type: orderType }, orderBy: 'created_at' })
  }

  async findActiveByItem(itemId: string, warehouseId?: string): Promise<InventoryReservationEntity[]> {
    const filters: Record<string, any> = { item_id: itemId, status: 'active' }
    if (warehouseId) filters.warehouse_id = warehouseId
    return this.findMany({ filters, orderBy: 'created_at' })
  }

  async getTotalReserved(itemId: string, warehouseId?: string): Promise<number> {
    const reservations = await this.findActiveByItem(itemId, warehouseId)
    return reservations.reduce((sum, r) => sum + (r.qty - r.qty_delivered - r.qty_cancelled), 0)
  }

  async fulfill(reservationId: string, qty: number): Promise<void> {
    const reservation = await this.findById(reservationId)
    if (!reservation) throw new RepositoryError('الحجز غير موجود')

    const newDelivered = reservation.qty_delivered + qty
    const newStatus = newDelivered >= reservation.qty ? 'fulfilled' : 'partial'

    await this.update(reservationId, {
      qty_delivered: newDelivered,
      status: newStatus,
    } as any)
  }

  async cancel(reservationId: string): Promise<void> {
    await this.update(reservationId, { status: 'cancelled', qty_cancelled: this.db.rpc('get_qty', {} as any) } as any)

    const reservation = await this.findById(reservationId)
    if (reservation) {
      await this.update(reservationId, {
        status: 'cancelled',
        qty_cancelled: reservation.qty - reservation.qty_delivered,
      } as any)
    }
  }

  async expireOverdue(): Promise<number> {
    const { data, error } = await this.db
      .from('inventory_reservations')
      .update({ status: 'expired' })
      .eq('company_id', this.companyId)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []).length
  }
}

export class InventoryAllocationRepository extends BaseInventoryRepository<InventoryAllocationEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_allocations')
  }

  async findByReservation(reservationId: string): Promise<InventoryAllocationEntity[]> {
    return this.findMany({ filters: { reservation_id: reservationId } })
  }

  async findPendingByWarehouse(warehouseId: string): Promise<InventoryAllocationEntity[]> {
    return this.findMany({ filters: { warehouse_id: warehouseId, status: 'pending' }, orderBy: 'created_at' })
  }

  async pick(allocationId: string, pickerId: string): Promise<void> {
    await this.update(allocationId, { status: 'picked', picker_id: pickerId, picked_at: new Date().toISOString() } as any)
  }

  async pack(allocationId: string): Promise<void> {
    await this.update(allocationId, { status: 'packed', packed_at: new Date().toISOString() } as any)
  }

  async ship(allocationId: string): Promise<void> {
    await this.update(allocationId, { status: 'shipped', shipped_at: new Date().toISOString() } as any)
  }
}
