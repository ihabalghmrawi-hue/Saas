export interface InvoiceEntity extends Record<string, unknown> {
  id: string; company_id: string; invoice_no: string
  order_id?: string; quotation_id?: string
  customer_id: string; customer_name?: string; customer_tax_no?: string
  branch_id?: string; cost_center_id?: string; status: string; invoice_type: string
  invoice_date: string; due_date: string; posted_at?: string; posted_by?: string
  subtotal: number; discount_amount: number; tax_amount: number; total: number
  paid_amount: number; notes?: string; terms?: string
  reversed_from_id?: string; reversal_reason?: string
  created_by?: string; metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface InvoiceLineEntity extends Record<string, unknown> {
  id: string; invoice_id: string; company_id: string; line_no: number
  item_id?: string; variant_id?: string; item_code?: string; item_name?: string; description?: string
  qty: number; unit: string; unit_price: number; unit_cost?: number
  discount_percent?: number; discount_amount?: number; tax_rate?: number; tax_amount?: number; total: number
  warehouse_id?: string; cost_center_id?: string
  account_revenue_id?: string; account_cogs_id?: string
  metadata?: Record<string, unknown>; created_at: string
}

export interface CreateInvoiceInput {
  order_id?: string; quotation_id?: string; customer_id: string
  customer_name?: string; customer_tax_no?: string; customer_email?: string
  branch_id?: string; cost_center_id?: string; invoice_type?: string
  invoice_date?: string; due_date?: string; discount_type?: string
  discount_value?: number; notes?: string; terms?: string
  created_by?: string; metadata?: Record<string, unknown>
  lines: Array<{
    item_id?: string; variant_id?: string; item_code?: string; item_name?: string; description?: string
    qty: number; unit?: string; unit_price: number; unit_cost?: number
    discount_percent?: number; tax_rate?: number; warehouse_id?: string; cost_center_id?: string
    account_revenue_id?: string; account_cogs_id?: string
  }>
}

export interface InvoiceSummary {
  invoice_id: string; invoice_no: string; customer_id: string; customer_name: string
  invoice_date: string; due_date: string; status: string; total: number
  paid_amount: number; balance_due: number; days_overdue: number
}
