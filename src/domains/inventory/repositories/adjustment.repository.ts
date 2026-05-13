import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository, RepositoryError } from './base'
import type { InventoryAdjustmentEntity, InventoryCountSessionEntity, InventoryCountLineEntity } from '../entities/adjustment.entity'

export class InventoryAdjustmentRepository extends BaseInventoryRepository<InventoryAdjustmentEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_adjustments')
  }

  async generateAdjustmentNo(): Promise<string> {
    const { count } = await this.db
      .from('inventory_adjustments')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
    return `ADJ-${String((count || 0) + 1).padStart(6, '0')}`
  }
}

export class InventoryCountSessionRepository extends BaseInventoryRepository<InventoryCountSessionEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_count_sessions')
  }

  async generateSessionNo(): Promise<string> {
    const { count } = await this.db
      .from('inventory_count_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
    return `CT-${String((count || 0) + 1).padStart(6, '0')}`
  }
}

export class InventoryCountLineRepository extends BaseInventoryRepository<InventoryCountLineEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_count_lines')
  }

  async findBySession(sessionId: string): Promise<InventoryCountLineEntity[]> {
    return this.findMany({ filters: { session_id: sessionId } })
  }

  async findByItem(itemId: string): Promise<InventoryCountLineEntity[]> {
    return this.findMany({ filters: { item_id: itemId }, orderBy: 'created_at', orderDir: 'desc' })
  }
}
