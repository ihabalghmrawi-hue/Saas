import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { CustomerCreditLimitEntity } from '../entities/credit-limit.entity'

export class CustomerCreditLimitRepository extends BaseSalesRepository<CustomerCreditLimitEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'customer_credit_limits') }

  async findByCustomer(customerId: string): Promise<CustomerCreditLimitEntity | null> {
    const { data, error } = await this.db
      .from('customer_credit_limits')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('customer_id', customerId)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new RepositoryError(error.message, error.code)
    }
    return data as CustomerCreditLimitEntity
  }

  async updateBalance(customerId: string, newBalance: number): Promise<void> {
    const limit = await this.findByCustomer(customerId)
    if (!limit) throw new RepositoryError('حد الائتمان غير موجود')
    await this.update(limit.id, { current_balance: newBalance } as any)
  }

  async checkAndAlert(customerId: string): Promise<{ withinLimit: boolean; availableCredit: number }> {
    const limit = await this.findByCustomer(customerId)
    if (!limit) return { withinLimit: true, availableCredit: Infinity }
    const available = limit.credit_limit - limit.current_balance
    return { withinLimit: available >= 0, availableCredit: available }
  }
}

export class SalesIntegrityLogRepository extends BaseSalesRepository<any> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'sales_integrity_logs') }
  async findOpen(): Promise<any[]> { return this.findMany({ filters: { status: 'open' }, orderBy: 'detected_at', orderDir: 'desc' }) }
}
