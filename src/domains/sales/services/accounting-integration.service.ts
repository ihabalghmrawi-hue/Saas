import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountingDomain } from '../../accounting/domain'
import { InvoiceLineRepository } from '../repositories/invoice.repository'
import type { ServiceResult } from '../types'

export class SalesAccountingService {
  private readonly invoiceLineRepo: InvoiceLineRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.invoiceLineRepo = new InvoiceLineRepository(db, companyId)
  }

  async postSalesInvoice(invoiceId: string, options?: {
    accountReceivableId?: string; accountRevenueId?: string; accountTaxId?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const lines = await this.invoiceLineRepo.findByInvoice(invoiceId)
      const accounting = new AccountingDomain(this.db, this.companyId)

      const arAccount = options?.accountReceivableId || '1110'
      const revenueAccount = options?.accountRevenueId || '4001'
      const taxAccount = options?.accountTaxId || '2501'

      const totalRevenue = lines.reduce((s, l) => s + l.total - (l.tax_amount || 0), 0)
      const totalTax = lines.reduce((s, l) => s + (l.tax_amount || 0), 0)
      const totalAmount = totalRevenue + totalTax

      const journalLines = [
        { account_id: arAccount, debit: totalAmount, credit: 0, description: 'ذمم مدينة - فاتورة مبيعات' },
        ...(totalRevenue > 0 ? [{ account_id: revenueAccount, debit: 0, credit: totalRevenue, description: 'إيرادات مبيعات' }] : []),
        ...(totalTax > 0 ? [{ account_id: taxAccount, debit: 0, credit: totalTax, description: 'ضريبة القيمة المضافة' }] : []),
      ]

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `فاتورة مبيعات ${invoiceId}`,
        source: 'sales_invoice', source_id: invoiceId,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR', lines: journalLines,
      } as any)

      if (!result.ok) return result
      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SALES_POST_FAILED' }
    }
  }

  async postSalesReturn(creditNoteId: string, options?: {
    accountReceivableId?: string; accountRevenueId?: string; accountTaxId?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const accounting = new AccountingDomain(this.db, this.companyId)
      const arAccount = options?.accountReceivableId || '1110'
      const revenueAccount = options?.accountRevenueId || '4001'
      const taxAccount = options?.accountTaxId || '2501'

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `إشعار دائن ${creditNoteId}`,
        source: 'credit_note', source_id: creditNoteId,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR',
        lines: [
          { account_id: arAccount, debit: 0, credit: 1, description: 'عكس ذمم مدينة' },
          { account_id: revenueAccount, debit: 1, credit: 0, description: 'عكس إيرادات' },
          { account_id: taxAccount, debit: 1, credit: 0, description: 'عكس ضريبة' },
        ],
      })

      if (!result.ok) return result
      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RETURN_POST_FAILED' }
    }
  }

  async postCustomerPayment(paymentId: string, options?: {
    accountCashId?: string; accountReceivableId?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const cashAccount = options?.accountCashId || '1101'
      const arAccount = options?.accountReceivableId || '1110'
      const accounting = new AccountingDomain(this.db, this.companyId)

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `دفعة عميل ${paymentId}`,
        source: 'customer_payment', source_id: paymentId,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR',
        lines: [
          { account_id: cashAccount, debit: 1, credit: 0, description: 'مقبوضات نقدية' },
          { account_id: arAccount, debit: 0, credit: 1, description: 'تسوية ذمم مدينة' },
        ],
      })

      if (!result.ok) return result
      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PAYMENT_POST_FAILED' }
    }
  }
}
