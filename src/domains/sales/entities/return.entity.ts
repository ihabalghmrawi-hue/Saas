export interface SalesReturnEntity extends Record<string, unknown> {
  id: string; company_id: string; return_no: string; invoice_id?: string; order_id?: string; shipment_id?: string
  customer_id: string; customer_name?: string; branch_id?: string; warehouse_id?: string
  status: string; return_type: string; reason?: string; reason_ar?: string; total: number
  credit_note_id?: string; created_by?: string; approved_by?: string
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface ReturnLineEntity extends Record<string, unknown> {
  id: string; return_id: string; company_id: string; invoice_line_id?: string
  item_id: string; item_code?: string; item_name?: string
  qty: number; unit_price: number; unit_cost?: number; total: number
  condition?: string; reason?: string; metadata?: Record<string, unknown>; created_at: string
}

export interface CreateReturnInput {
  invoice_id?: string; order_id?: string; shipment_id?: string; customer_id: string; customer_name?: string
  branch_id?: string; warehouse_id?: string; return_type?: string; reason?: string; reason_ar?: string
  created_by?: string; metadata?: Record<string, unknown>
  lines: Array<{
    invoice_line_id?: string; item_id: string; item_code?: string; item_name?: string
    qty: number; unit_price: number; unit_cost?: number; condition?: string; reason?: string
  }>
}
