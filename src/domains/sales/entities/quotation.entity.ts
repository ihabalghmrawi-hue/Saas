export interface QuotationEntity extends Record<string, unknown> {
  id: string; company_id: string; quotation_no: string; customer_id: string
  customer_name?: string; customer_tax_no?: string; branch_id?: string; cost_center_id?: string
  status: string; valid_until?: string; subtotal: number; discount_amount: number
  tax_amount: number; total: number; notes?: string; terms?: string
  created_by?: string; approved_by?: string; converted_to_order_id?: string
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface QuotationLineEntity extends Record<string, unknown> {
  id: string; quotation_id: string; company_id: string; line_no: number
  item_id?: string; item_code?: string; item_name?: string; description?: string
  qty: number; unit: string; unit_price: number; discount_percent?: number
  discount_amount?: number; tax_rate?: number; tax_amount?: number; total: number
  warehouse_id?: string; delivery_date?: string; metadata?: Record<string, unknown>; created_at: string
}

export interface CreateQuotationInput {
  customer_id: string; customer_name?: string; customer_tax_no?: string
  branch_id?: string; cost_center_id?: string; currency?: string; valid_until?: string
  notes?: string; terms?: string; created_by?: string; metadata?: Record<string, unknown>
  lines: Array<{
    item_id?: string; item_code?: string; item_name?: string; description?: string
    qty: number; unit?: string; unit_price: number; discount_percent?: number
    tax_rate?: number; warehouse_id?: string; delivery_date?: string
  }>
}
