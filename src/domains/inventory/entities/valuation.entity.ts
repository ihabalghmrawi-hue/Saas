export interface InventoryValuationLayerEntity extends Record<string, unknown> {
  id: string
  company_id: string
  item_id: string
  variant_id?: string
  batch_id?: string
  warehouse_id: string
  layer_date: string
  qty_in: number
  qty_out: number
  qty_remaining: number
  unit_cost: number
  total_cost_in: number
  total_cost_out: number
  total_cost_remaining: number
  movement_id?: string
  reference_type?: string
  reference_id?: string
  created_at: string
}

export interface InventorySnapshotEntity extends Record<string, unknown> {
  id: string
  company_id: string
  snapshot_date: string
  warehouse_id?: string
  item_id?: string
  variant_id?: string
  qty: number
  unit_cost: number
  total_value: number
  snapshot_type: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface ValuationSummary {
  item_id: string
  item_code: string
  item_name: string
  cost_method: string
  total_qty: number
  total_value: number
  weighted_avg_cost: number
  layers: InventoryValuationLayerEntity[]
}
