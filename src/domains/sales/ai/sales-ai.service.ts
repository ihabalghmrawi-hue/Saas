import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceRepository } from '../repositories/invoice.repository'
import { CustomerCreditLimitRepository } from '../repositories/credit-limit.repository'
import { SalesReportGenerator } from '../reports/report-generator'
import type { ServiceResult } from '../types'

export interface PricingSuggestion {
  item_id: string; current_price: number; suggested_price: number; reason: string; confidence: number
}

export interface CustomerRiskScore {
  customer_id: string; score: number; level: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
}

export class SalesAIService {
  private readonly invoiceRepo: InvoiceRepository
  private readonly creditLimitRepo: CustomerCreditLimitRepository
  private readonly reportGenerator: SalesReportGenerator

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.invoiceRepo = new InvoiceRepository(db, companyId)
    this.creditLimitRepo = new CustomerCreditLimitRepository(db, companyId)
    this.reportGenerator = new SalesReportGenerator(db, companyId)
  }

  async getCustomerRiskScores(): Promise<ServiceResult<CustomerRiskScore[]>> {
    try {
      const aging = await this.reportGenerator.generateCustomerAging()
      if (!aging.ok) return aging as any

      const scores: CustomerRiskScore[] = (aging.data || []).map(a => {
        const totalOverdue = a.days_1_30 + a.days_31_60 + a.days_61_90 + a.days_90_plus
        const overdueRatio = a.total_balance > 0 ? totalOverdue / a.total_balance : 0

        let level: CustomerRiskScore['level']
        let score: number

        if (a.days_90_plus > 0 || overdueRatio > 0.8) { level = 'critical'; score = 90 }
        else if (a.days_61_90 > 0 || overdueRatio > 0.5) { level = 'high'; score = 70 }
        else if (a.days_31_60 > 0 || overdueRatio > 0.3) { level = 'medium'; score = 40 }
        else { level = 'low'; score = 10 }

        const factors: string[] = []
        if (a.days_90_plus > 0) factors.push('أكثر من 90 يوم متأخر')
        if (a.days_61_90 > 0) factors.push('61-90 يوم متأخر')
        if (a.total_balance > 100000) factors.push('رصيد مرتفع')

        return { customer_id: a.customer_id, score, level, factors }
      })

      return { ok: true, data: scores }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RISK_SCORE_FAILED' }
    }
  }

  async predictOverdue(customerId: string): Promise<ServiceResult<{ probability: number; risk_level: string; days_estimated: number }>> {
    try {
      const invoices = await this.invoiceRepo.findByCustomer(customerId)
      const overdueInvoices = invoices.filter(i => i.status === 'overdue' || i.status === 'partially_paid')
      const totalInvoices = invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled').length

      const overdueRate = totalInvoices > 0 ? overdueInvoices.length / totalInvoices : 0
      const totalOverdueAmount = overdueInvoices.reduce((s, i: any) => s + (i.balance_due ?? 0), 0)
      const avgInvoiceValue = totalInvoices > 0
        ? invoices.filter(i => i.status !== 'draft').reduce((s, i) => s + i.total, 0) / totalInvoices
        : 0

      let probability = overdueRate * 0.6 + (totalOverdueAmount > avgInvoiceValue * 2 ? 0.2 : 0) + (overdueInvoices.length > 3 ? 0.2 : 0)
      probability = Math.min(1, probability)

      const riskLevel = probability > 0.7 ? 'high' : probability > 0.4 ? 'medium' : 'low'
      const daysEstimated = Math.round(30 + (1 - probability) * 60)

      return { ok: true, data: { probability, risk_level: riskLevel, days_estimated: daysEstimated } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PREDICT_FAILED' }
    }
  }
}
