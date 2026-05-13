import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceRepository, InvoiceLineRepository } from '../repositories/invoice.repository'
import { SalesOrderRepository, SalesOrderLineRepository } from '../repositories/order.repository'
import { CustomerPaymentRepository } from '../repositories/payment.repository'
import { RepositoryError } from '../repositories/base'
import type { ServiceResult } from '../types'

export interface SalesSummaryReport {
  period_from: string; period_to: string; total_invoices: number; total_sales: number
  total_tax: number; total_discount: number; net_sales: number
  paid_amount: number; outstanding: number
}

export interface CustomerAgingReport {
  customer_id: string; customer_name: string; total_balance: number
  current: number; days_1_30: number; days_31_60: number; days_61_90: number; days_90_plus: number
}

export interface ProductProfitability {
  item_id: string; item_code: string; item_name: string; qty_sold: number
  revenue: number; cost: number; profit: number; margin_percent: number
}

export class SalesReportGenerator {
  private readonly invoiceRepo: InvoiceRepository
  private readonly invoiceLineRepo: InvoiceLineRepository
  private readonly orderRepo: SalesOrderRepository
  private readonly orderLineRepo: SalesOrderLineRepository
  private readonly paymentRepo: CustomerPaymentRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.invoiceRepo = new InvoiceRepository(db, companyId)
    this.invoiceLineRepo = new InvoiceLineRepository(db, companyId)
    this.orderRepo = new SalesOrderRepository(db, companyId)
    this.orderLineRepo = new SalesOrderLineRepository(db, companyId)
    this.paymentRepo = new CustomerPaymentRepository(db, companyId)
  }

  async generateSalesSummary(fromDate: string, toDate: string): Promise<ServiceResult<SalesSummaryReport>> {
    try {
      const { data, error } = await this.db.rpc('get_sales_summary', {
        p_company_id: this.companyId, p_from_date: fromDate, p_to_date: toDate,
      })
      if (error) throw new RepositoryError(error.message, error.code)

      const rows: Array<{ total_sales: number; total_tax: number; total_discount: number; net_sales: number }> = data || []
      const totals = rows.reduce((acc, r) => ({
        total_sales: acc.total_sales + Number(r.total_sales || 0),
        total_tax: acc.total_tax + Number(r.total_tax || 0),
        total_discount: acc.total_discount + Number(r.total_discount || 0),
        net_sales: acc.net_sales + Number(r.net_sales || 0),
      }), { total_sales: 0, total_tax: 0, total_discount: 0, net_sales: 0 })

      return {
        ok: true,
        data: {
          period_from: fromDate, period_to: toDate, total_invoices: (data || []).length,
          total_sales: totals.total_sales, total_tax: totals.total_tax,
          total_discount: totals.total_discount, net_sales: totals.net_sales,
          paid_amount: 0, outstanding: totals.net_sales,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SALES_SUMMARY_FAILED' }
    }
  }

  async generateCustomerAging(asOfDate?: string): Promise<ServiceResult<CustomerAgingReport[]>> {
    try {
      const date = asOfDate || new Date().toISOString().slice(0, 10)
      const { data, error } = await this.db.rpc('get_customer_aging', {
        p_company_id: this.companyId, p_as_of_date: date,
      })
      if (error) throw new RepositoryError(error.message, error.code)
      return { ok: true, data: (data || []) as CustomerAgingReport[] }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'AGING_FAILED' }
    }
  }

  async generateProductProfitability(fromDate: string, toDate: string): Promise<ServiceResult<ProductProfitability[]>> {
    try {
      const invoices = await this.invoiceRepo.findMany({
        filters: {}, orderBy: 'invoice_date',
      })

      const report: ProductProfitability[] = []
      const itemMap = new Map<string, { qty: number; revenue: number; cost: number }>()

      for (const inv of invoices) {
        if (inv.status === 'cancelled' || inv.status === 'reversed') continue
        if (inv.invoice_date < fromDate || inv.invoice_date > toDate) continue

        const lines = await this.invoiceLineRepo.findByInvoice(inv.id)
        for (const line of lines) {
          if (!line.item_id) continue
          const existing = itemMap.get(line.item_id) || { qty: 0, revenue: 0, cost: 0 }
          existing.qty += line.qty
          existing.revenue += line.total
          existing.cost += (line.unit_cost || 0) * line.qty
          itemMap.set(line.item_id, existing)
        }
      }

      for (const [itemId, data] of itemMap) {
        const profit = data.revenue - data.cost
        report.push({
          item_id: itemId, item_code: '', item_name: '',
          qty_sold: data.qty, revenue: data.revenue, cost: data.cost,
          profit, margin_percent: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        })
      }

      return { ok: true, data: report.sort((a, b) => b.profit - a.profit) }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PROFITABILITY_FAILED' }
    }
  }
}
