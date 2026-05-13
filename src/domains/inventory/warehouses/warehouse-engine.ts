import type { SupabaseClient } from '@supabase/supabase-js'
import { WarehouseRepository, WarehouseLocationRepository } from '../repositories/warehouse.repository'
import type { WarehouseEntity, WarehouseLocationEntity, WarehouseTree } from '../entities/warehouse.entity'
import type { ServiceResult } from '../types'

export class WarehouseEngine {
  private readonly warehouseRepo: WarehouseRepository
  private readonly locationRepo: WarehouseLocationRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.warehouseRepo = new WarehouseRepository(db, companyId)
    this.locationRepo = new WarehouseLocationRepository(db, companyId)
  }

  async createWarehouse(input: {
    code: string
    name: string
    name_ar?: string
    type?: string
    address?: string
    city?: string
    country?: string
    is_default?: boolean
    branch_id?: string
    manager_id?: string
    contact_phone?: string
    contact_email?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<WarehouseEntity>> {
    try {
      const existing = await this.warehouseRepo.findByCode(input.code)
      if (existing) {
        return { ok: false, error: 'رمز المستودع موجود مسبقاً', code: 'DUPLICATE_CODE' }
      }

      if (input.is_default) {
        const current = await this.warehouseRepo.getDefault()
        if (current) {
          await this.warehouseRepo.update(current.id, { is_default: false } as any)
        }
      }

      const warehouse = await this.warehouseRepo.create(input as any)
      return { ok: true, data: warehouse }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CREATE_WAREHOUSE_FAILED' }
    }
  }

  async createLocation(input: {
    warehouse_id: string
    code: string
    name?: string
    name_ar?: string
    type?: string
    is_pickable?: boolean
    max_weight?: number
    max_volume?: number
    zone?: string
    aisle?: string
    rack?: string
    shelf?: string
    barcode?: string
    parent_location_id?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<WarehouseLocationEntity>> {
    try {
      const location = await this.locationRepo.create(input as any)
      return { ok: true, data: location }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CREATE_LOCATION_FAILED' }
    }
  }

  async getWarehouseTree(): Promise<ServiceResult<WarehouseTree[]>> {
    try {
      const tree = await this.warehouseRepo.getTree()
      return { ok: true, data: tree }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TREE_FAILED' }
    }
  }

  async listWarehouses(): Promise<ServiceResult<WarehouseEntity[]>> {
    try {
      const warehouses = await this.warehouseRepo.findAllActive()
      return { ok: true, data: warehouses }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LIST_FAILED' }
    }
  }

  async listLocations(warehouseId: string): Promise<ServiceResult<WarehouseLocationEntity[]>> {
    try {
      const locations = await this.locationRepo.findByWarehouse(warehouseId)
      return { ok: true, data: locations }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LOCATIONS_FAILED' }
    }
  }

  async getDefault(): Promise<ServiceResult<WarehouseEntity | null>> {
    try {
      const warehouse = await this.warehouseRepo.getDefault()
      return { ok: true, data: warehouse }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'DEFAULT_FAILED' }
    }
  }
}
