import type { SupabaseClient } from '@supabase/supabase-js'
import { OrderEngine } from '../orders/order-engine'
import { InvoiceEngine } from '../invoicing/invoice-engine'
import { PaymentEngine } from '../payments/payment-engine'
import { ReturnEngine } from '../returns/return-engine'
import { FulfillmentEngine } from '../fulfillment/fulfillment-engine'
import { InventoryOrchestrator } from '../services/inventory-orchestrator.service'
import { SalesAccountingService } from '../services/accounting-integration.service'
import type { ServiceResult } from '../types'

export class SalesWorkflow {
  private readonly orderEngine: OrderEngine
  private readonly invoiceEngine: InvoiceEngine
  private readonly paymentEngine: PaymentEngine
  private readonly returnEngine: ReturnEngine
  private readonly fulfillmentEngine: FulfillmentEngine
  private readonly inventory: InventoryOrchestrator
  private readonly accounting: SalesAccountingService

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.orderEngine = new OrderEngine(db, companyId)
    this.invoiceEngine = new InvoiceEngine(db, companyId)
    this.paymentEngine = new PaymentEngine(db, companyId)
    this.returnEngine = new ReturnEngine(db, companyId)
    this.fulfillmentEngine = new FulfillmentEngine(db, companyId)
    this.inventory = new InventoryOrchestrator(db, companyId)
    this.accounting = new SalesAccountingService(db, companyId)
  }

  async createOrderAndInvoice(input: {
    customer_id: string; customer_name?: string; branch_id?: string
    lines: Array<{ item_id: string; item_name?: string; qty: number; unit_price: number; tax_rate?: number; warehouse_id: string }>
    created_by?: string
  }): Promise<ServiceResult<{ order_id: string; invoice_id: string; invoice_no: string }>> {
    const order = await this.orderEngine.createOrder({
      customer_id: input.customer_id, customer_name: input.customer_name,
      branch_id: input.branch_id, created_by: input.created_by,
      lines: input.lines,
    })
    if (!order.ok) return order

    const approveResult = await this.orderEngine.approveOrder(order.data.id, input.created_by)
    if (!approveResult.ok) return approveResult

    const invoice = await this.invoiceEngine.create({
      order_id: order.data.id, customer_id: input.customer_id,
      customer_name: input.customer_name, branch_id: input.branch_id,
      created_by: input.created_by,
      lines: input.lines.map(l => ({
        item_id: l.item_id, qty: l.qty, unit_price: l.unit_price,
        tax_rate: l.tax_rate, warehouse_id: l.warehouse_id,
      })),
    })
    if (!invoice.ok) return invoice

    return {
      ok: true,
      data: { order_id: order.data.id, invoice_id: invoice.data.id, invoice_no: invoice.data.invoice_no },
    }
  }

  async postInvoiceWithInventory(invoiceId: string, lines: Array<{ item_id: string; warehouse_id: string; qty: number; unit_cost?: number }>, postedBy?: string): Promise<ServiceResult<{ journal_entry_id: string }>> {
    const postResult = await this.invoiceEngine.post(invoiceId, postedBy)
    if (!postResult.ok) return postResult

    const reserveResult = await this.inventory.reserveForInvoice(invoiceId, lines)
    if (!reserveResult.ok) return reserveResult

    const issueResult = await this.inventory.issueForInvoice(invoiceId, lines)
    if (!issueResult.ok) return issueResult

    const accountingResult = await this.accounting.postSalesInvoice(invoiceId)
    return accountingResult
  }

  async processReturnWithCreditNote(returnInput: {
    invoice_id: string; customer_id: string; customer_name?: string; warehouse_id?: string
    reason?: string; created_by?: string
    lines: Array<{ item_id: string; qty: number; unit_price: number; unit_cost?: number }>
  }): Promise<ServiceResult<{ return_id: string; credit_note_id: string }>> {
    const salesReturn = await this.returnEngine.createReturn({
      invoice_id: returnInput.invoice_id, customer_id: returnInput.customer_id,
      customer_name: returnInput.customer_name, warehouse_id: returnInput.warehouse_id,
      reason: returnInput.reason, created_by: returnInput.created_by,
      lines: returnInput.lines,
    })
    if (!salesReturn.ok) return salesReturn

    const completeResult = await this.returnEngine.completeReturn(salesReturn.data.id, returnInput.created_by)
    if (!completeResult.ok) return completeResult

    await this.inventory.receiveReturn(returnInput.invoice_id, returnInput.lines.map(l => ({
      item_id: l.item_id, warehouse_id: returnInput.warehouse_id || '',
      qty: l.qty, unit_cost: l.unit_cost,
    })))

    return {
      ok: true,
      data: { return_id: salesReturn.data.id, credit_note_id: completeResult.data.credit_note_id },
    }
  }
}
