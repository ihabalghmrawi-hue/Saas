export interface InventoryAdjustmentEntity extends Record<string, unknown> {
  id: string
  company_id: string
  adjustment_no: string
  warehouse_id: string
  type: string
  status: string
  reason?: string
  reason_ar?: string
  reference_type?: string
  reference_id?: string
  approved_by?: string
  posted_by?: string
  posted_at?: string
  notes?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface InventoryCountSessionEntity extends Record<string, unknown> {
  id: string
  company_id: string
  warehouse_id: string
  session_no: string
  type: string
  status: string
  started_by?: string
  completed_by?: string
  approved_by?: string
  notes?: string
  scheduled_date?: string
  started_at?: string
  completed_at?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface InventoryCountLineEntity extends Record<string, unknown> {
  id: string
  session_id: string
  company_id: string
  item_id: string
  variant_id?: string
  batch_id?: string
  location_id?: string
  expected_qty: number
  counted_qty?: number
  variance_qty: number
  unit_cost: number
  variance_cost: number
  status: string
  counted_by?: string
  verified_by?: string
  notes?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}
