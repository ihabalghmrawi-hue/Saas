export interface InventoryReservationEntity extends Record<string, unknown> {
  id: string
  company_id: string
  item_id: string
  variant_id?: string
  batch_id?: string
  warehouse_id: string
  location_id?: string
  order_id?: string
  order_type?: string
  order_line_id?: string
  qty: number
  qty_delivered: number
  qty_cancelled: number
  type: string
  status: string
  expires_at?: string
  created_by?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface InventoryAllocationEntity extends Record<string, unknown> {
  id: string
  company_id: string
  reservation_id?: string
  item_id: string
  batch_id?: string
  warehouse_id: string
  location_id?: string
  picker_id?: string
  order_line_id?: string
  qty: number
  status: string
  picked_at?: string
  packed_at?: string
  shipped_at?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateReservationInput {
  item_id: string
  variant_id?: string
  batch_id?: string
  warehouse_id: string
  location_id?: string
  order_id?: string
  order_type?: string
  order_line_id?: string
  qty: number
  type?: string
  expires_at?: string
  created_by?: string
  metadata?: Record<string, unknown>
}

export interface ReservationSummary {
  total_reserved: number
  total_available: number
  reservations: InventoryReservationEntity[]
}
