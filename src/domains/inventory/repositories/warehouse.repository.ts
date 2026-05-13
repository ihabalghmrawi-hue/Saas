import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository } from './base'
import type { WarehouseEntity, WarehouseLocationEntity, WarehouseTree } from '../entities/warehouse.entity'

export class WarehouseRepository extends BaseInventoryRepository<WarehouseEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'warehouses')
  }

  async findAllActive(): Promise<WarehouseEntity[]> {
    return this.findMany({ filters: { is_active: true }, orderBy: 'name' })
  }

  async findByCode(code: string): Promise<WarehouseEntity | null> {
    const { data, error } = await this.db
      .from('warehouses')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('code', code)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as WarehouseEntity
  }

  async getDefault(): Promise<WarehouseEntity | null> {
    const { data, error } = await this.db
      .from('warehouses')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_default', true)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as WarehouseEntity
  }

  async getTree(): Promise<WarehouseTree[]> {
    const warehouses = await this.findAllActive()
    const trees: WarehouseTree[] = []

    for (const wh of warehouses) {
      const { data: locations } = await this.db
        .from('warehouse_locations')
        .select('*')
        .eq('warehouse_id', wh.id)
        .order('code')

      trees.push({
        warehouse: wh,
        locations: (locations || []) as WarehouseLocationEntity[],
      })
    }

    return trees
  }
}

export class WarehouseLocationRepository extends BaseInventoryRepository<WarehouseLocationEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'warehouse_locations')
  }

  async findByWarehouse(warehouseId: string): Promise<WarehouseLocationEntity[]> {
    return this.findMany({ filters: { warehouse_id: warehouseId, is_active: true }, orderBy: 'code' })
  }

  async findPickable(warehouseId: string): Promise<WarehouseLocationEntity[]> {
    return this.findMany({ filters: { warehouse_id: warehouseId, is_pickable: true, is_active: true } })
  }
}
