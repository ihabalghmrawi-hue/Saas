import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceRepository, InvoiceLineRepository } from '../repositories/invoice.repository'
import { SalesOrderRepository, SalesOrderLineRepository } from '../repositories/order.repository'
import { SalesEventBus } from '../events/event-bus'
import type { InvoiceEntity, InvoiceLineEntity, CreateInvoiceInput } from '../entities/invoice.entity'
import type { ServiceResult } from '../types'

export class InvoiceEngine {
  private readonly invoiceRepo: InvoiceRepository
  private readonly lineRepo: InvoiceLineRepository
  private readonly orderRepo: SalesOrderRepository
  private readonly orderLineRepo: SalesOrderLineRepository
  private readonly eventBus: SalesEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.invoiceRepo = new InvoiceRepository(db, companyId)
    this.lineRepo = new InvoiceLineRepository(db, companyId)
    this.orderRepo = new SalesOrderRepository(db, companyId)
    this.orderLineRepo = new SalesOrderLineRepository(db, companyId)
    this.eventBus = SalesEventBus.getInstance()
  }

  async create(input: CreateInvoiceInput): Promise<ServiceResult<{ id: string; invoice_no: string }>> {
    try {
      const invoiceNo = await this.invoiceRepo.generateInvoiceNo()
      let subtotal = 0; let taxAmount = 0; let discountAmount = 0

      const lines = input.lines.map((l, i) => {
        const lineTotal = l.qty * l.unit_price
        const discAmt = l.discount_percent ? lineTotal * (l.discount_percent / 100) : 0
        const taxable = lineTotal - discAmt
        const tax = taxable * ((l.tax_rate || 0) / 100)
        subtotal += lineTotal; discountAmount += discAmt; taxAmount += tax
        return {
          line_no: i + 1, item_id: l.item_id, variant_id: l.variant_id,
          item_code: l.item_code, item_name: l.item_name, description: l.description,
          qty: l.qty, unit: l.unit || 'piece', unit_price: l.unit_price, unit_cost: l.unit_cost,
          discount_percent: l.discount_percent || 0, discount_amount: discAmt,
          tax_rate: l.tax_rate || 0, tax_amount: tax, total: taxable + tax,
          warehouse_id: l.warehouse_id, cost_center_id: l.cost_center_id,
          account_revenue_id: l.account_revenue_id, account_cogs_id: l.account_cogs_id,
        }
      })

      const total = subtotal - discountAmount + taxAmount
      const dueDate = input.due_date || (() => {
        const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
      })()

      const invoice = await this.invoiceRepo.create({
        invoice_no: invoiceNo, order_id: input.order_id, customer_id: input.customer_id,
        customer_name: input.customer_name, branch_id: input.branch_id, cost_center_id: input.cost_center_id,
        invoice_type: input.invoice_type || 'standard', status: 'draft',
        invoice_date: input.invoice_date || new Date().toISOString().slice(0, 10),
        due_date: dueDate, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total,
        paid_amount: 0, notes: input.notes, terms: input.terms, created_by: input.created_by,
        metadata: input.metadata,
      } as any)

      await this.lineRepo.createBatch(lines.map(l => ({ invoice_id: invoice.id, company_id: this.companyId, ...l })))

      if (input.order_id) {
        for (const l of lines) {
          if (l.item_id) {
            const orderLines = await this.orderLineRepo.findByOrder(input.order_id)
            const match = orderLines.find(ol => ol.item_id === l.item_id)
            if (match) await this.orderLineRepo.updateInvoicedQty(match.id, l.qty)
          }
        }
      }

      return { ok: true, data: { id: invoice.id, invoice_no: invoiceNo } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'INVOICE_CREATE_FAILED' }
    }
  }

  async post(invoiceId: string, postedBy?: string): Promise<ServiceResult<InvoiceEntity>> {
    try {
      const invoice = await this.invoiceRepo.findById(invoiceId)
      if (!invoice) return { ok: false, error: 'الفاتورة غير موجودة', code: 'NOT_FOUND' }
      if (invoice.status !== 'draft') return { ok: false, error: 'يمكن ترحيل المسودات فقط', code: 'INVALID_STATUS' }

      const updated = await this.invoiceRepo.update(invoiceId, {
        status: 'posted', posted_by: postedBy, posted_at: new Date().toISOString(),
      } as any)

      this.eventBus.emit('sales.invoice.posted', {
        id: invoiceId, type: 'invoice_posted', companyId: this.companyId,
        invoiceId, customerId: invoice.customer_id, amount: invoice.total,
        description: `ترحيل فاتورة ${invoice.invoice_no}`, reference: invoice.invoice_no,
        performedBy: postedBy, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'POST_FAILED' }
    }
  }

  async reverse(invoiceId: string, reason: string, reversedBy?: string): Promise<ServiceResult<InvoiceEntity>> {
    try {
      const invoice = await this.invoiceRepo.findById(invoiceId)
      if (!invoice) return { ok: false, error: 'الفاتورة غير موجودة', code: 'NOT_FOUND' }
      if (invoice.status === 'paid') return { ok: false, error: 'لا يمكن عكس فاتورة مدفوعة بالكامل', code: 'ALREADY_PAID' }

      const reversalNo = await this.invoiceRepo.generateInvoiceNo()
      const reversal = await this.invoiceRepo.create({
        invoice_no: reversalNo, customer_id: invoice.customer_id, customer_name: invoice.customer_name,
        branch_id: invoice.branch_id, invoice_type: 'correction', status: 'posted',
        invoice_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10),
        subtotal: -invoice.subtotal, discount_amount: -invoice.discount_amount,
        tax_amount: -invoice.tax_amount, total: -invoice.total, paid_amount: 0,
        reversed_from_id: invoiceId, reversal_reason: reason, notes: `عكس: ${reason}`,
        created_by: reversedBy, posted_by: reversedBy, posted_at: new Date().toISOString(),
      } as any)

      await this.invoiceRepo.update(invoiceId, { status: 'reversed', reversal_reason: reason } as any)

      const origLines = await this.lineRepo.findByInvoice(invoiceId)
      for (const l of origLines) {
        await this.lineRepo.create({
          invoice_id: reversal.id, company_id: this.companyId, line_no: l.line_no,
          item_id: l.item_id, item_code: l.item_code, item_name: l.item_name,
          qty: -l.qty, unit: l.unit, unit_price: l.unit_price, unit_cost: l.unit_cost,
          discount_amount: -(l.discount_amount ?? 0), tax_rate: l.tax_rate,
          tax_amount: -(l.tax_amount ?? 0), total: -(l.total ?? 0), warehouse_id: l.warehouse_id,
          account_revenue_id: l.account_revenue_id, account_cogs_id: l.account_cogs_id,
        } as any)
      }

      this.eventBus.emit('sales.invoice.reversed', {
        id: invoiceId, type: 'invoice_reversed', companyId: this.companyId,
        invoiceId, customerId: invoice.customer_id, amount: invoice.total,
        description: `عكس فاتورة ${invoice.invoice_no}: ${reason}`,
        performedBy: reversedBy, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: reversal }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REVERSE_FAILED' }
    }
  }

  async markOverdue(): Promise<ServiceResult<number>> {
    try {
      const count = await this.invoiceRepo.markOverdue()
      return { ok: true, data: count }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'MARK_OVERDUE_FAILED' }
    }
  }
}
