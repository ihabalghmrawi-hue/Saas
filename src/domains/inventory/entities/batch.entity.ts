export interface InventoryBatchEntity extends Record<string, unknown> {
  id: string
  company_id: string
  item_id: string
  variant_id?: string
  batch_no: string
  supplier_batch?: string
  manufacturing_date?: string
  expiry_date?: string
  received_date: string
  initial_qty: number
  available_qty: number
  unit_cost: number
  location_id?: string
  warehouse_id?: string
  status: string
  is_active: boolean
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateBatchInput {
  item_id: string
  variant_id?: string
  batch_no: string
  supplier_batch?: string
  manufacturing_date?: string
  expiry_date?: string
  received_date?: string
  initial_qty: number
  available_qty?: number
  unit_cost: number
  location_id?: string
  warehouse_id?: string
  metadata?: Record<string, unknown>
}
