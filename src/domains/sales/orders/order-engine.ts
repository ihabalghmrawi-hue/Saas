import type { SupabaseClient } from '@supabase/supabase-js'
import { SalesOrderRepository, SalesOrderLineRepository } from '../repositories/order.repository'
import { QuotationRepository, QuotationLineRepository } from '../repositories/quotation.repository'
import { SalesEventBus } from '../events/event-bus'
import type { SalesOrderEntity, CreateSalesOrderInput } from '../entities/order.entity'
import type { ServiceResult } from '../types'

export class OrderEngine {
  private readonly orderRepo: SalesOrderRepository
  private readonly lineRepo: SalesOrderLineRepository
  private readonly quoteRepo: QuotationRepository
  private readonly quoteLineRepo: QuotationLineRepository
  private readonly eventBus: SalesEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.orderRepo = new SalesOrderRepository(db, companyId)
    this.lineRepo = new SalesOrderLineRepository(db, companyId)
    this.quoteRepo = new QuotationRepository(db, companyId)
    this.quoteLineRepo = new QuotationLineRepository(db, companyId)
    this.eventBus = SalesEventBus.getInstance()
  }

  async createQuotation(input: {
    customer_id: string; customer_name?: string; branch_id?: string
    valid_until?: string; notes?: string; created_by?: string; metadata?: Record<string, unknown>
    lines: Array<{ item_id?: string; item_name?: string; qty: number; unit_price: number; tax_rate?: number; warehouse_id?: string }>
  }): Promise<ServiceResult<{ id: string; quotation_no: string }>> {
    try {
      const quoteNo = await this.quoteRepo.generateQuotationNo()
      let subtotal = 0; let taxAmount = 0

      const lines = input.lines.map((l, i) => {
        const total = l.qty * l.unit_price
        const tax = total * ((l.tax_rate || 0) / 100)
        subtotal += total; taxAmount += tax
        return { line_no: i + 1, ...l, unit: 'piece', total: total, tax_amount: tax, discount_amount: 0 }
      })

      const total = subtotal + taxAmount
      const quote = await this.quoteRepo.create({
        quotation_no: quoteNo, customer_id: input.customer_id, customer_name: input.customer_name,
        branch_id: input.branch_id, status: 'draft', valid_until: input.valid_until,
        subtotal, tax_amount: taxAmount, total, created_by: input.created_by, notes: input.notes,
        metadata: input.metadata,
      } as any)

      for (const line of lines) {
        await this.quoteLineRepo.create({ quotation_id: quote.id, company_id: this.companyId, ...line } as any)
      }

      this.eventBus.emit('sales.quotation.created', {
        id: quote.id, type: 'quotation', companyId: this.companyId, customerId: input.customer_id,
        amount: total, description: `عرض سعر ${quoteNo}`, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: { id: quote.id, quotation_no: quoteNo } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'QUOTE_CREATE_FAILED' }
    }
  }

  async createOrder(input: CreateSalesOrderInput): Promise<ServiceResult<{ id: string; order_no: string }>> {
    try {
      const orderNo = await this.orderRepo.generateOrderNo()
      let subtotal = 0; let taxAmount = 0

      const lines = input.lines.map((l, i) => {
        const total = l.qty * l.unit_price
        const tax = total * ((l.tax_rate || 0) / 100)
        subtotal += total; taxAmount += tax
        return { line_no: i + 1, ...l, unit: l.unit || 'piece', total, tax_amount: tax, discount_amount: 0, qty_fulfilled: 0, qty_invoiced: 0, qty_returned: 0 }
      })

      const total = subtotal + taxAmount
      const order = await this.orderRepo.create({
        order_no: orderNo, customer_id: input.customer_id, customer_name: input.customer_name,
        quotation_id: input.quotation_id, branch_id: input.branch_id, cost_center_id: input.cost_center_id,
        status: 'draft', order_date: input.order_date || new Date().toISOString().slice(0, 10),
        expected_delivery_date: input.expected_delivery_date,
        subtotal, tax_amount: taxAmount, total, paid_amount: 0,
        notes: input.notes, terms: input.terms, created_by: input.created_by, metadata: input.metadata,
      } as any)

      for (const line of lines) {
        await this.lineRepo.create({ order_id: order.id, company_id: this.companyId, ...line } as any)
      }

      if (input.quotation_id) {
        await this.quoteRepo.update(input.quotation_id, { converted_to_order_id: order.id, status: 'accepted' } as any)
      }

      this.eventBus.emit('sales.order.created', {
        id: order.id, type: 'order', companyId: this.companyId, customerId: input.customer_id,
        orderId: order.id, amount: total, description: `أمر بيع ${orderNo}`, reference: orderNo,
        performedBy: input.created_by, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: { id: order.id, order_no: orderNo } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ORDER_CREATE_FAILED' }
    }
  }

  async approveOrder(orderId: string, approvedBy?: string): Promise<ServiceResult<SalesOrderEntity>> {
    try {
      const order = await this.orderRepo.findById(orderId)
      if (!order) return { ok: false, error: 'الأمر غير موجود', code: 'NOT_FOUND' }
      if (order.status !== 'draft') return { ok: false, error: 'يمكن اعتماد المسودات فقط', code: 'INVALID_STATUS' }

      const updated = await this.orderRepo.update(orderId, { status: 'approved', approved_by: approvedBy } as any)

      this.eventBus.emit('sales.order.approved', {
        id: orderId, type: 'order_approved', companyId: this.companyId, orderId,
        customerId: order.customer_id, amount: order.total, description: `تم اعتماد أمر البيع ${order.order_no}`,
        performedBy: approvedBy, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'APPROVE_FAILED' }
    }
  }

  async updateOrderFulfillment(orderId: string): Promise<void> {
    const lines = await this.lineRepo.findByOrder(orderId)
    const allFulfilled = lines.every(l => l.qty_fulfilled >= l.qty)
    const anyFulfilled = lines.some(l => l.qty_fulfilled > 0)
    const status = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partially_fulfilled' : 'approved'
    await this.orderRepo.update(orderId, { status } as any)

    if (allFulfilled) {
      this.eventBus.emit('sales.order.fulfilled', {
        id: orderId, type: 'order_fulfilled', companyId: this.companyId, orderId,
        amount: 0, description: 'اكتمل أمر البيع', timestamp: new Date().toISOString(),
      })
    }
  }
}
