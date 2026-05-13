export interface SalesOrderEntity extends Record<string, unknown> {
  id: string; company_id: string; order_no: string; quotation_id?: string
  customer_id: string; customer_name?: string; customer_tax_no?: string
  branch_id?: string; cost_center_id?: string; status: string
  order_date: string; expected_delivery_date?: string
  subtotal: number; discount_amount: number; tax_amount: number; total: number
  paid_amount: number; notes?: string; terms?: string
  created_by?: string; approved_by?: string
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface SalesOrderLineEntity extends Record<string, unknown> {
  id: string; order_id: string; company_id: string; line_no: number
  item_id?: string; variant_id?: string; item_code?: string; item_name?: string
  description?: string; qty: number; qty_fulfilled: number; qty_invoiced: number; qty_returned: number
  unit: string; unit_price: number; unit_cost?: number
  discount_percent?: number; discount_amount?: number; tax_rate?: number; tax_amount?: number; total: number
  warehouse_id?: string; expected_delivery_date?: string
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface CreateSalesOrderInput {
  quotation_id?: string; customer_id: string; customer_name?: string; customer_tax_no?: string
  branch_id?: string; cost_center_id?: string; currency?: string; order_date?: string
  expected_delivery_date?: string; notes?: string; terms?: string; created_by?: string
  metadata?: Record<string, unknown>
  lines: Array<{
    item_id?: string; variant_id?: string; item_code?: string; item_name?: string; description?: string
    qty: number; unit?: string; unit_price: number; unit_cost?: number
    discount_percent?: number; tax_rate?: number; warehouse_id?: string; expected_delivery_date?: string
  }>
}
