export interface InventoryTransferEntity extends Record<string, unknown> {
  id: string
  company_id: string
  transfer_no: string
  from_warehouse_id: string
  to_warehouse_id: string
  from_branch_id?: string
  to_branch_id?: string
  status: string
  type: string
  requested_by?: string
  approved_by?: string
  received_by?: string
  notes?: string
  notes_ar?: string
  expected_delivery_date?: string
  received_date?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TransferLineEntity extends Record<string, unknown> {
  id: string
  transfer_id: string
  company_id: string
  item_id: string
  variant_id?: string
  batch_id?: string
  from_location_id?: string
  to_location_id?: string
  qty: number
  qty_received: number
  unit_cost: number
  total_cost: number
  notes?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTransferInput {
  from_warehouse_id: string
  to_warehouse_id: string
  from_branch_id?: string
  to_branch_id?: string
  type?: string
  requested_by?: string
  notes?: string
  notes_ar?: string
  expected_delivery_date?: string
  metadata?: Record<string, unknown>
  lines: Array<{
    item_id: string
    variant_id?: string
    batch_id?: string
    from_location_id?: string
    to_location_id?: string
    qty: number
    notes?: string
  }>
}
