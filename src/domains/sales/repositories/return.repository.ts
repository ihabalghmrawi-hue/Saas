import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { SalesReturnEntity, ReturnLineEntity } from '../entities/return.entity'

export class SalesReturnRepository extends BaseSalesRepository<SalesReturnEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'sales_returns') }

  async generateReturnNo(): Promise<string> {
    const { count } = await this.db.from('sales_returns').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `R-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByCustomer(customerId: string): Promise<SalesReturnEntity[]> {
    return this.findMany({ filters: { customer_id: customerId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findByInvoice(invoiceId: string): Promise<SalesReturnEntity[]> {
    return this.findMany({ filters: { invoice_id: invoiceId }, orderBy: 'created_at', orderDir: 'desc' })
  }
}

export class ReturnLineRepository extends BaseSalesRepository<ReturnLineEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'return_lines') }
  async findByReturn(returnId: string): Promise<ReturnLineEntity[]> {
    return this.findMany({ filters: { return_id: returnId } })
  }
}
