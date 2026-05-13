import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository } from './base'
import type { SalesPricingRuleEntity } from '../entities/pricing.entity'

export class SalesPricingRuleRepository extends BaseSalesRepository<SalesPricingRuleEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'sales_pricing_rules') }

  async findActive(): Promise<SalesPricingRuleEntity[]> {
    return this.findMany({ filters: { is_active: true }, orderBy: 'priority', orderDir: 'desc' })
  }

  async findByType(type: string): Promise<SalesPricingRuleEntity[]> {
    return this.findMany({ filters: { is_active: true, type }, orderBy: 'priority', orderDir: 'desc' })
  }
}
