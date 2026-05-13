import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceRepository } from '../repositories/invoice.repository'
import { SalesOrderRepository, SalesOrderLineRepository } from '../repositories/order.repository'
import { CustomerPaymentRepository } from '../repositories/payment.repository'
import { SalesIntegrityLogRepository } from '../repositories/credit-limit.repository'
import { SalesEventBus } from '../events/event-bus'
import type { ServiceResult } from '../types'

export interface IntegrityCheck {
  check_type: string; status: 'passed' | 'failed' | 'warning'; details: Record<string, any>
}

export class SalesIntegrityService {
  private readonly invoiceRepo: InvoiceRepository
  private readonly orderRepo: SalesOrderRepository
  private readonly orderLineRepo: SalesOrderLineRepository
  private readonly paymentRepo: CustomerPaymentRepository
  private readonly logRepo: SalesIntegrityLogRepository
  private readonly eventBus: SalesEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.invoiceRepo = new InvoiceRepository(db, companyId)
    this.orderRepo = new SalesOrderRepository(db, companyId)
    this.orderLineRepo = new SalesOrderLineRepository(db, companyId)
    this.paymentRepo = new CustomerPaymentRepository(db, companyId)
    this.logRepo = new SalesIntegrityLogRepository(db, companyId)
    this.eventBus = SalesEventBus.getInstance()
  }

  async runAllChecks(): Promise<ServiceResult<IntegrityCheck[]>> {
    const results: IntegrityCheck[] = [
      await this.checkUnbalancedInvoices(),
      await this.checkOverdueInvoices(),
      await this.checkOrderFulfillment(),
      await this.checkUnallocatedPayments(),
    ]
    return { ok: true, data: results }
  }

  private async checkUnbalancedInvoices(): Promise<IntegrityCheck> {
    const invoices = await this.invoiceRepo.findMany({ filters: {}, limit: 1000 })
    const unbalanced = invoices.filter((i: any) => {
      const expectedBalance = i.total - i.paid_amount
      return Math.abs(expectedBalance - i.balance_due) > 0.01
    })
    return { check_type: 'unbalanced_invoices', status: unbalanced.length === 0 ? 'passed' : 'failed', details: { count: unbalanced.length } }
  }

  private async checkOverdueInvoices(): Promise<IntegrityCheck> {
    const overdue = await this.invoiceRepo.findOverdue()
    for (const inv of (overdue as any[])) {
      const balanceDue = inv.balance_due ?? 0
      if (inv.status !== 'overdue') {
        this.eventBus.emit('sales.invoice.overdue', {
          id: inv.id, type: 'overdue', companyId: this.companyId,
          invoiceId: inv.id, customerId: inv.customer_id, amount: balanceDue,
          description: `فاتورة متأخرة ${inv.invoice_no}: ${balanceDue}`,
          timestamp: new Date().toISOString(),
        })
      }
    }
    return { check_type: 'overdue_invoices', status: overdue.length === 0 ? 'passed' : 'warning', details: { count: overdue.length } }
  }

  private async checkOrderFulfillment(): Promise<IntegrityCheck> {
    const orders = await this.orderRepo.findMany({ filters: { status: 'approved' } })
    const issues: Array<{ order_id: string; item_id: string }> = []
    for (const order of orders) {
      const lines = await this.orderLineRepo.findByOrder(order.id)
      for (const line of lines) {
        if (line.qty_fulfilled > line.qty) {
          issues.push({ order_id: order.id, item_id: line.item_id || '' })
        }
      }
    }
    return { check_type: 'order_fulfillment', status: issues.length === 0 ? 'passed' : 'warning', details: { count: issues.length, issues } }
  }

  private async checkUnallocatedPayments(): Promise<IntegrityCheck> {
    const unallocated = await this.paymentRepo.findUnallocated()
    return { check_type: 'unallocated_payments', status: unallocated.length === 0 ? 'passed' : 'warning', details: { count: unallocated.length } }
  }
}
