import type { SupabaseClient } from '@supabase/supabase-js'
import { SalesShipmentRepository, ShipmentLineRepository } from '../repositories/shipment.repository'
import { SalesOrderLineRepository } from '../repositories/order.repository'
import { InvoiceRepository, InvoiceLineRepository } from '../repositories/invoice.repository'
import { SalesEventBus } from '../events/event-bus'
import type { SalesShipmentEntity, CreateShipmentInput } from '../entities/shipment.entity'
import type { ServiceResult } from '../types'

export class FulfillmentEngine {
  private readonly shipmentRepo: SalesShipmentRepository
  private readonly shipLineRepo: ShipmentLineRepository
  private readonly orderLineRepo: SalesOrderLineRepository
  private readonly invoiceRepo: InvoiceRepository
  private readonly invoiceLineRepo: InvoiceLineRepository
  private readonly eventBus: SalesEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.shipmentRepo = new SalesShipmentRepository(db, companyId)
    this.shipLineRepo = new ShipmentLineRepository(db, companyId)
    this.orderLineRepo = new SalesOrderLineRepository(db, companyId)
    this.invoiceRepo = new InvoiceRepository(db, companyId)
    this.invoiceLineRepo = new InvoiceLineRepository(db, companyId)
    this.eventBus = SalesEventBus.getInstance()
  }

  async createShipment(input: CreateShipmentInput): Promise<ServiceResult<{ id: string; shipment_no: string }>> {
    try {
      const shipmentNo = await this.shipmentRepo.generateShipmentNo()

      const shipment = await this.shipmentRepo.create({
        shipment_no: shipmentNo, order_id: input.order_id, invoice_id: input.invoice_id,
        warehouse_id: input.warehouse_id, customer_id: input.customer_id,
        customer_name: input.customer_name, shipping_address: input.shipping_address,
        status: 'pending', carrier: input.carrier, tracking_no: input.tracking_no,
        notes: input.notes, created_by: input.created_by, metadata: input.metadata,
      } as any)

      await this.shipLineRepo.createBatch(
        input.lines.map(l => ({
          shipment_id: shipment.id, company_id: this.companyId,
          order_line_id: l.order_line_id, item_id: l.item_id,
          item_code: l.item_code, item_name: l.item_name,
          qty: l.qty, qty_delivered: 0, batch_id: l.batch_id,
        })),
      )

      return { ok: true, data: { id: shipment.id, shipment_no: shipmentNo } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SHIPMENT_CREATE_FAILED' }
    }
  }

  async ship(shipmentId: string, carrier?: string, trackingNo?: string): Promise<ServiceResult<SalesShipmentEntity>> {
    try {
      const updated = await this.shipmentRepo.update(shipmentId, {
        status: 'shipped', carrier: carrier || undefined, tracking_no: trackingNo || undefined,
        shipped_date: new Date().toISOString(),
      } as any)
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SHIP_FAILED' }
    }
  }

  async deliver(shipmentId: string): Promise<ServiceResult<SalesShipmentEntity>> {
    try {
      const shipment = await this.shipmentRepo.findById(shipmentId)
      if (!shipment) return { ok: false, error: 'الشحنة غير موجودة', code: 'NOT_FOUND' }

      const updated = await this.shipmentRepo.update(shipmentId, {
        status: 'delivered', delivered_date: new Date().toISOString(),
      } as any)

      const lines = await this.shipLineRepo.findByShipment(shipmentId)
      for (const line of lines) {
        if (line.order_line_id) {
          await this.orderLineRepo.updateFulfilledQty(line.order_line_id, line.qty)
        }
      }

      await this.shipLineRepo.update(shipmentId, {} as any)
      for (const line of lines) {
        await this.shipLineRepo.update(line.id, { qty_delivered: line.qty } as any)
      }

      this.eventBus.emit('sales.shipment.delivered', {
        id: shipmentId, type: 'shipment_delivered', companyId: this.companyId,
        orderId: shipment.order_id, customerId: shipment.customer_id, amount: 0,
        description: `تسليم شحنة ${shipment.shipment_no}`, reference: shipment.shipment_no,
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'DELIVER_FAILED' }
    }
  }

  async updateShipmentStatus(shipmentId: string, status: string): Promise<ServiceResult<SalesShipmentEntity>> {
    try {
      const updated = await this.shipmentRepo.update(shipmentId, { status } as any)
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'STATUS_UPDATE_FAILED' }
    }
  }
}
