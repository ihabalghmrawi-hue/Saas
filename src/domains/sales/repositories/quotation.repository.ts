import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { QuotationEntity, QuotationLineEntity } from '../entities/quotation.entity'

export class QuotationRepository extends BaseSalesRepository<QuotationEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'quotations') }

  async generateQuotationNo(): Promise<string> {
    const { count } = await this.db.from('quotations').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `Q-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByCustomer(customerId: string): Promise<QuotationEntity[]> {
    return this.findMany({ filters: { customer_id: customerId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findByStatus(status: string): Promise<QuotationEntity[]> {
    return this.findMany({ filters: { status }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async markExpired(): Promise<number> {
    const { data, error } = await this.db
      .from('quotations')
      .update({ status: 'expired' })
      .eq('company_id', this.companyId)
      .eq('status', 'sent')
      .lt('valid_until', new Date().toISOString().slice(0, 10))
      .select('id')
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []).length
  }
}

export class QuotationLineRepository extends BaseSalesRepository<QuotationLineEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'quotation_lines') }
  async findByQuotation(quotationId: string): Promise<QuotationLineEntity[]> {
    return this.findMany({ filters: { quotation_id: quotationId }, orderBy: 'line_no' })
  }
}
