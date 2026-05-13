import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { InvoiceEntity, InvoiceLineEntity } from '../entities/invoice.entity'

export class InvoiceRepository extends BaseSalesRepository<InvoiceEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'invoices') }

  async generateInvoiceNo(): Promise<string> {
    const { count } = await this.db.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `INV-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByCustomer(customerId: string): Promise<InvoiceEntity[]> {
    return this.findMany({ filters: { customer_id: customerId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findByStatus(status: string): Promise<InvoiceEntity[]> {
    return this.findMany({ filters: { status }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findOverdue(asOfDate?: string): Promise<InvoiceEntity[]> {
    const date = asOfDate || new Date().toISOString().slice(0, 10)
    const { data, error } = await this.db
      .from('invoices')
      .select('*')
      .eq('company_id', this.companyId)
      .in('status', ['posted', 'partially_paid'])
      .lt('due_date', date)
      .gt('balance_due', 0)
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as InvoiceEntity[]
  }

  async findOverdueByCustomer(customerId: string): Promise<InvoiceEntity[]> {
    const date = new Date().toISOString().slice(0, 10)
    const { data, error } = await this.db
      .from('invoices')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('customer_id', customerId)
      .in('status', ['posted', 'partially_paid'])
      .lt('due_date', date)
      .gt('balance_due', 0)
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as InvoiceEntity[]
  }

  async markOverdue(): Promise<number> {
    const overdue = await this.findOverdue()
    let count = 0
    for (const inv of overdue) {
      if (inv.status !== 'overdue') {
        await this.update(inv.id, { status: 'overdue' } as any)
        count++
      }
    }
    return count
  }
}

export class InvoiceLineRepository extends BaseSalesRepository<InvoiceLineEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'invoice_lines') }

  async findByInvoice(invoiceId: string): Promise<InvoiceLineEntity[]> {
    return this.findMany({ filters: { invoice_id: invoiceId }, orderBy: 'line_no' })
  }

  async createBatch(lines: Array<Record<string, unknown>>): Promise<InvoiceLineEntity[]> {
    const rows = lines.map(l => ({ company_id: this.companyId, ...l }))
    const { data, error } = await this.db.from('invoice_lines').insert(rows).select('*')
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as InvoiceLineEntity[]
  }
}
