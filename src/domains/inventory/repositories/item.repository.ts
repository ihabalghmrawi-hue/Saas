import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository } from './base'
import type { InventoryItemEntity, InventoryVariantEntity } from '../entities/item.entity'

export class InventoryItemRepository extends BaseInventoryRepository<InventoryItemEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_items')
  }

  async findAllActive(): Promise<InventoryItemEntity[]> {
    return this.findMany({ filters: { is_active: true }, orderBy: 'code' })
  }

  async findByCode(code: string): Promise<InventoryItemEntity | null> {
    const { data, error } = await this.db
      .from('inventory_items')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('code', code)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as InventoryItemEntity
  }

  async findByCategory(category: string): Promise<InventoryItemEntity[]> {
    return this.findMany({ filters: { category, is_active: true } })
  }

  async findLowStock(): Promise<InventoryItemEntity[]> {
    const { data, error } = await this.db
      .from('inventory_items')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_active', true)
      .lte('reorder_point', this.db.rpc('get_current_stock', {
        p_company_id: this.companyId,
        p_item_id: 'id',
      } as any))
    if (error) throw error
    return (data || []) as InventoryItemEntity[]
  }
}

export class InventoryVariantRepository extends BaseInventoryRepository<InventoryVariantEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_variants')
  }

  async findByItem(itemId: string): Promise<InventoryVariantEntity[]> {
    return this.findMany({ filters: { item_id: itemId, is_active: true } })
  }
}
