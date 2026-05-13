import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository, RepositoryError } from './base'
import type { InventoryValuationLayerEntity, InventorySnapshotEntity } from '../entities/valuation.entity'

export class InventoryValuationLayerRepository extends BaseInventoryRepository<InventoryValuationLayerEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_valuation_layers')
  }

  async findByItem(itemId: string, warehouseId: string): Promise<InventoryValuationLayerEntity[]> {
    return this.findMany({
      filters: { item_id: itemId, warehouse_id: warehouseId },
      orderBy: 'layer_date',
    })
  }

  async findActiveLayers(itemId: string, warehouseId: string): Promise<InventoryValuationLayerEntity[]> {
    return this.findMany({
      filters: { item_id: itemId, warehouse_id: warehouseId },
      orderBy: 'layer_date',
    }).then(layers => layers.filter(l => l.qty_remaining > 0))
  }

  async addLayer(input: Partial<InventoryValuationLayerEntity>): Promise<InventoryValuationLayerEntity> {
    const { data, error } = await this.db
      .from('inventory_valuation_layers')
      .insert({ company_id: this.companyId, ...input })
      .select('*')
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as InventoryValuationLayerEntity
  }

  async consumeFifo(itemId: string, warehouseId: string, qty: number): Promise<{ layers: InventoryValuationLayerEntity[]; totalCost: number }> {
    const layers = await this.findActiveLayers(itemId, warehouseId)
    let remaining = qty
    let totalCost = 0
    const consumedLayers: InventoryValuationLayerEntity[] = []

    for (const layer of layers) {
      if (remaining <= 0) break

      const consumeQty = Math.min(remaining, layer.qty_remaining)
      const cost = consumeQty * layer.unit_cost

      await this.update(layer.id, {
        qty_out: layer.qty_out + consumeQty,
        qty_remaining: layer.qty_remaining - consumeQty,
        total_cost_out: layer.total_cost_out + cost,
        total_cost_remaining: layer.total_cost_remaining - cost,
      } as any)

      consumedLayers.push({ ...layer, qty_remaining: layer.qty_remaining - consumeQty })
      remaining -= consumeQty
      totalCost += cost
    }

    return { layers: consumedLayers, totalCost }
  }

  async getWeightedAverageCost(itemId: string, warehouseId: string): Promise<number> {
    const layers = await this.findActiveLayers(itemId, warehouseId)
    if (layers.length === 0) return 0

    const totalQty = layers.reduce((s, l) => s + l.qty_remaining, 0)
    const totalCost = layers.reduce((s, l) => s + l.total_cost_remaining, 0)
    return totalQty > 0 ? totalCost / totalQty : 0
  }
}

export class InventorySnapshotRepository extends BaseInventoryRepository<InventorySnapshotEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_snapshots')
  }

  async findLatest(warehouseId?: string): Promise<InventorySnapshotEntity[]> {
    const filters: Record<string, any> = {}
    if (warehouseId) filters.warehouse_id = warehouseId
    return this.findMany({ filters, orderBy: 'snapshot_date', orderDir: 'desc', limit: 1 })
  }

  async findByDateRange(fromDate: string, toDate: string, warehouseId?: string): Promise<InventorySnapshotEntity[]> {
    const { data, error } = await this.db
      .from('inventory_snapshots')
      .select('*')
      .eq('company_id', this.companyId)
      .gte('snapshot_date', fromDate)
      .lte('snapshot_date', toDate)
      .eq(warehouseId ? 'warehouse_id' : 'company_id', warehouseId || this.companyId)
      .order('snapshot_date', { ascending: false })

    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as InventorySnapshotEntity[]
  }

  async generateDailySnapshot(warehouseId?: string): Promise<number> {
    const { data, error } = await this.db.rpc('generate_inventory_snapshot', {
      p_company_id: this.companyId,
      p_snapshot_date: new Date().toISOString().slice(0, 10),
      p_warehouse_id: warehouseId || null,
    })
    if (error) throw new RepositoryError(error.message, error.code)
    return Number(data || 0)
  }
}

export class ReorderRuleRepository extends BaseInventoryRepository<any> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'reorder_rules')
  }

  async findByItem(itemId: string): Promise<any[]> {
    return this.findMany({ filters: { item_id: itemId, is_active: true } })
  }

  async findRulesDueForReorder(): Promise<any[]> {
    return this.findMany({ filters: { is_active: true, auto_generate: true } })
  }
}

export class InventoryIntegrityLogRepository extends BaseInventoryRepository<any> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_integrity_logs')
  }

  async findOpen(): Promise<any[]> {
    return this.findMany({ filters: { status: 'open' }, orderBy: 'detected_at', orderDir: 'desc' })
  }
}
