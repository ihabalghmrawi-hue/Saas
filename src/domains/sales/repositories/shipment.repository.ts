import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { SalesShipmentEntity, ShipmentLineEntity } from '../entities/shipment.entity'

export class SalesShipmentRepository extends BaseSalesRepository<SalesShipmentEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'sales_shipments') }

  async generateShipmentNo(): Promise<string> {
    const { count } = await this.db.from('sales_shipments').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `SH-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByOrder(orderId: string): Promise<SalesShipmentEntity[]> {
    return this.findMany({ filters: { order_id: orderId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findByStatus(status: string): Promise<SalesShipmentEntity[]> {
    return this.findMany({ filters: { status }, orderBy: 'created_at', orderDir: 'desc' })
  }
}

export class ShipmentLineRepository extends BaseSalesRepository<ShipmentLineEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'shipment_lines') }

  async findByShipment(shipmentId: string): Promise<ShipmentLineEntity[]> {
    return this.findMany({ filters: { shipment_id: shipmentId } })
  }

  async createBatch(lines: Array<Record<string, unknown>>): Promise<ShipmentLineEntity[]> {
    const rows = lines.map(l => ({ company_id: this.companyId, ...l }))
    const { data, error } = await this.db.from('shipment_lines').insert(rows).select('*')
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as ShipmentLineEntity[]
  }
}
