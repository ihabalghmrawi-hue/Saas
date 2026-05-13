import type { SupabaseClient } from '@supabase/supabase-js'
import { SalesReturnRepository, ReturnLineRepository } from '../repositories/return.repository'
import { CreditNoteRepository, CreditNoteLineRepository } from '../repositories/credit-note.repository'
import { InvoiceLineRepository } from '../repositories/invoice.repository'
import { SalesOrderLineRepository } from '../repositories/order.repository'
import { SalesEventBus } from '../events/event-bus'
import type { SalesReturnEntity, CreateReturnInput } from '../entities/return.entity'
import type { CreditNoteEntity } from '../entities/credit-note.entity'
import type { ServiceResult } from '../types'

export class ReturnEngine {
  private readonly returnRepo: SalesReturnRepository
  private readonly returnLineRepo: ReturnLineRepository
  private readonly cnRepo: CreditNoteRepository
  private readonly cnLineRepo: CreditNoteLineRepository
  private readonly invoiceLineRepo: InvoiceLineRepository
  private readonly orderLineRepo: SalesOrderLineRepository
  private readonly eventBus: SalesEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.returnRepo = new SalesReturnRepository(db, companyId)
    this.returnLineRepo = new ReturnLineRepository(db, companyId)
    this.cnRepo = new CreditNoteRepository(db, companyId)
    this.cnLineRepo = new CreditNoteLineRepository(db, companyId)
    this.invoiceLineRepo = new InvoiceLineRepository(db, companyId)
    this.orderLineRepo = new SalesOrderLineRepository(db, companyId)
    this.eventBus = SalesEventBus.getInstance()
  }

  async createReturn(input: CreateReturnInput): Promise<ServiceResult<{ id: string; return_no: string }>> {
    try {
      const returnNo = await this.returnRepo.generateReturnNo()
      let total = 0

      const lines = input.lines.map(l => {
        const lineTotal = l.qty * l.unit_price
        total += lineTotal
        return { ...l, total: lineTotal }
      })

      const salesReturn = await this.returnRepo.create({
        return_no: returnNo, invoice_id: input.invoice_id, order_id: input.order_id,
        customer_id: input.customer_id, customer_name: input.customer_name,
        branch_id: input.branch_id, warehouse_id: input.warehouse_id,
        status: 'draft', return_type: input.return_type || 'partial',
        reason: input.reason, reason_ar: input.reason_ar, total,
        created_by: input.created_by, metadata: input.metadata,
      } as any)

      for (const line of lines) {
        await this.returnLineRepo.create({
          return_id: salesReturn.id, company_id: this.companyId, ...line,
        } as any)
      }

      this.eventBus.emit('sales.return.created', {
        id: salesReturn.id, type: 'return', companyId: this.companyId,
        returnId: salesReturn.id, customerId: input.customer_id, amount: total,
        description: `مرتجع ${returnNo}`, reference: input.invoice_id,
        performedBy: input.created_by, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: { id: salesReturn.id, return_no: returnNo } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RETURN_CREATE_FAILED' }
    }
  }

  async completeReturn(returnId: string, completedBy?: string): Promise<ServiceResult<{ credit_note_id: string }>> {
    try {
      const salesReturn = await this.returnRepo.findById(returnId)
      if (!salesReturn) return { ok: false, error: 'المرتجع غير موجود', code: 'NOT_FOUND' }

      const lines = await this.returnLineRepo.findByReturn(returnId)
      const cnNo = await this.cnRepo.generateCreditNoteNo()

      let subtotal = 0; let taxAmount = 0
      const cnLines = lines.map(l => {
        const tax = l.total * 0.15
        subtotal += l.total; taxAmount += tax
        return {
          invoice_line_id: l.invoice_line_id, item_id: l.item_id, item_code: l.item_code, item_name: l.item_name,
          qty: l.qty, unit: 'piece', unit_price: l.unit_price, unit_cost: l.unit_cost,
          tax_rate: 15, tax_amount: tax, total: l.total + tax, reason: l.reason,
        }
      })

      const cn = await this.cnRepo.create({
        credit_note_no: cnNo, invoice_id: salesReturn.invoice_id,
        customer_id: salesReturn.customer_id, customer_name: salesReturn.customer_name,
        branch_id: salesReturn.branch_id, status: 'posted', credit_note_type: 'return',
        reason: salesReturn.reason, reason_ar: salesReturn.reason_ar,
        subtotal, tax_amount: taxAmount, total: subtotal + taxAmount, applied_amount: 0,
        posted_by: completedBy, posted_at: new Date().toISOString(), created_by: completedBy,
      } as any)

      for (const l of cnLines) {
        await this.cnLineRepo.create({ credit_note_id: cn.id, company_id: this.companyId, ...l } as any)
      }

      if (salesReturn.order_id) {
        for (const l of lines) {
          const orderLines = await this.orderLineRepo.findByOrder(salesReturn.order_id)
          const match = orderLines.find(ol => ol.item_id === l.item_id)
          if (match) await this.orderLineRepo.updateReturnedQty(match.id, l.qty)
        }
      }

      await this.returnRepo.update(returnId, {
        status: 'completed', credit_note_id: cn.id, approved_by: completedBy,
      } as any)

      this.eventBus.emit('sales.return.completed', {
        id: returnId, type: 'return_completed', companyId: this.companyId,
        returnId, customerId: salesReturn.customer_id, amount: subtotal + taxAmount,
        description: `اكتمال مرتجع ${salesReturn.return_no} - إشعار دائن ${cnNo}`,
        metadata: { credit_note_id: cn.id }, performedBy: completedBy, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: { credit_note_id: cn.id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'COMPLETE_RETURN_FAILED' }
    }
  }
}
