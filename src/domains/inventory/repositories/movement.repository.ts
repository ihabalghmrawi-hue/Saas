import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository, RepositoryError } from './base'
import type { StockMovementEntity, CreateMovementInput, MovementBatchInput, MovementResult, MovementHistoryFilter, StockBalance } from '../entities/movement.entity'

export class StockMovementRepository extends BaseInventoryRepository<StockMovementEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'stock_movements')
  }

  async createMovement(input: CreateMovementInput): Promise<StockMovementEntity> {
    const { data, error } = await this.db
      .from('stock_movements')
      .insert({ company_id: this.companyId, ...input })
      .select('*')
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as StockMovementEntity
  }

  async createBatch(input: MovementBatchInput): Promise<MovementResult[]> {
    const rows = input.movements.map(m => ({
      company_id: this.companyId,
      ...m,
    }))

    const { data, error } = await this.db
      .from('stock_movements')
      .insert(rows)
      .select('id, item_id, qty, unit_cost, total_cost')

    if (error) throw new RepositoryError(error.message, error.code)
    return ((data || []) as any[]).map(r => ({
      movement_id: r.id,
      item_id: r.item_id,
      qty: r.qty,
      unit_cost: r.unit_cost,
      total_cost: r.total_cost,
    }))
  }

  async findByReference(referenceType: string, referenceId: string): Promise<StockMovementEntity[]> {
    return this.findMany({ filters: { reference_type: referenceType, reference_id: referenceId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async getCurrentStock(itemId: string, warehouseId?: string): Promise<number> {
    const { data, error } = await this.db.rpc('get_current_stock', {
      p_company_id: this.companyId,
      p_item_id: itemId,
      p_warehouse_id: warehouseId || null,
    })
    if (error) throw new RepositoryError(error.message, error.code)
    return Number(data || 0)
  }

  async getWarehouseBalances(warehouseId?: string): Promise<StockBalance[]> {
    const { data, error } = await this.db.rpc('get_warehouse_balances', {
      p_company_id: this.companyId,
      p_warehouse_id: warehouseId || null,
    })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as StockBalance[]
  }

  async getHistory(filter: MovementHistoryFilter): Promise<StockMovementEntity[]> {
    const { data, error } = await this.db.rpc('get_movement_history', {
      p_company_id: this.companyId,
      p_item_id: filter.item_id || null,
      p_warehouse_id: filter.warehouse_id || null,
      p_from_date: filter.from_date || null,
      p_to_date: filter.to_date || null,
      p_limit: filter.limit || 100,
    })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as StockMovementEntity[]
  }

  async reverse(movementId: string, reason: string, createdBy?: string): Promise<StockMovementEntity> {
    const original = await this.findById(movementId)
    if (!original) throw new RepositoryError('الحركة غير موجودة')

    const reversal: CreateMovementInput = {
      item_id: original.item_id,
      variant_id: original.variant_id,
      batch_id: original.batch_id,
      warehouse_id: original.warehouse_id,
      location_id: original.location_id,
      movement_type: original.movement_type as any,
      direction: original.direction === 'in' ? 'out' as any : 'in' as any,
      qty: original.qty,
      unit_cost: original.unit_cost,
      total_cost: original.total_cost,
      reference_type: 'reversal',
      reference_id: movementId,
      source: original.source,
      source_id: original.source_id ? `${original.source_id}-rev` : undefined,
      description: `عكس: ${reason}`,
      created_by: createdBy,
      metadata: { reversed_from: movementId, original_movement_type: original.movement_type, reversal_reason: reason },
    }

    const movement = await this.create(reversal as unknown as Record<string, unknown>)

    await this.db
      .from('stock_movements')
      .update({ is_reversed: true, reversed_from_id: movement.id, reversal_reason: reason })
      .eq('id', movementId)

    return movement
  }
}
