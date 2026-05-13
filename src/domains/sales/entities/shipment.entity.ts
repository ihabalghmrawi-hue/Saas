export interface SalesShipmentEntity extends Record<string, unknown> {
  id: string; company_id: string; shipment_no: string; order_id?: string; invoice_id?: string
  warehouse_id: string; customer_id: string; customer_name?: string; shipping_address?: string
  status: string; carrier?: string; tracking_no?: string; shipped_date?: string; delivered_date?: string
  notes?: string; created_by?: string; metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface ShipmentLineEntity extends Record<string, unknown> {
  id: string; shipment_id: string; company_id: string; order_line_id?: string
  item_id: string; item_code?: string; item_name?: string
  qty: number; qty_delivered: number; warehouse_id?: string; batch_id?: string
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface CreateShipmentInput {
  order_id?: string; invoice_id?: string; warehouse_id: string; customer_id: string
  customer_name?: string; shipping_address?: string; carrier?: string; tracking_no?: string
  notes?: string; created_by?: string; metadata?: Record<string, unknown>
  lines: Array<{ order_line_id?: string; item_id: string; item_code?: string; item_name?: string; qty: number; batch_id?: string }>
}
