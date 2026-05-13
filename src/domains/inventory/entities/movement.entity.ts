export interface StockMovementEntity extends Record<string, unknown> {
  id: string
  company_id: string
  item_id: string
  variant_id?: string
  batch_id?: string
  warehouse_id: string
  location_id?: string
  to_warehouse_id?: string
  to_location_id?: string
  movement_type: string
  direction: string
  qty: number
  unit_cost: number
  total_cost: number
  unit_price?: number
  reference_type?: string
  reference_id?: string
  reference_line_id?: string
  source: string
  source_id?: string
  description?: string
  created_by?: string
  is_reversed: boolean
  reversed_from_id?: string
  reversal_reason?: string
  metadata?: Record<string, unknown>
  posted_at: string
  created_at: string
}

export interface CreateMovementInput {
  item_id: string
  variant_id?: string
  batch_id?: string
  warehouse_id: string
  location_id?: string
  to_warehouse_id?: string
  to_location_id?: string
  movement_type: string
  direction: string
  qty: number
  unit_cost?: number
  total_cost?: number
  unit_price?: number
  reference_type?: string
  reference_id?: string
  reference_line_id?: string
  source: string
  source_id?: string
  description?: string
  created_by?: string
  metadata?: Record<string, unknown>
}

export interface MovementBatchInput {
  movements: CreateMovementInput[]
  source: string
  source_id?: string
  created_by?: string
}

export interface MovementResult {
  movement_id: string
  item_id: string
  qty: number
  unit_cost: number
  total_cost: number
}

export interface StockBalance {
  item_id: string
  warehouse_id: string
  warehouse_name: string
  current_qty: number
  unit_cost: number
  total_value: number
}

export interface MovementHistoryFilter {
  item_id?: string
  warehouse_id?: string
  from_date?: string
  to_date?: string
  movement_type?: string
  limit?: number
  offset?: number
}
