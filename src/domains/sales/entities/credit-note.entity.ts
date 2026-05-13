export interface CreditNoteEntity extends Record<string, unknown> {
  id: string; company_id: string; credit_note_no: string; invoice_id?: string
  customer_id: string; customer_name?: string; customer_tax_no?: string
  branch_id?: string; cost_center_id?: string; status: string; credit_note_type: string
  reason?: string; reason_ar?: string; subtotal: number; tax_amount: number; total: number
  applied_amount: number; posted_at?: string; posted_by?: string; created_by?: string
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface CreditNoteLineEntity extends Record<string, unknown> {
  id: string; credit_note_id: string; company_id: string; invoice_line_id?: string
  item_id?: string; item_code?: string; item_name?: string; description?: string
  qty: number; unit: string; unit_price: number; unit_cost?: number
  discount_amount?: number; tax_rate?: number; tax_amount?: number; total: number
  reason?: string; metadata?: Record<string, unknown>; created_at: string
}

export interface CreateCreditNoteInput {
  invoice_id?: string; customer_id: string; customer_name?: string
  branch_id?: string; cost_center_id?: string; credit_note_type?: string
  reason?: string; reason_ar?: string; created_by?: string; metadata?: Record<string, unknown>
  lines: Array<{
    invoice_line_id?: string; item_id?: string; item_code?: string; item_name?: string; description?: string
    qty: number; unit?: string; unit_price: number; unit_cost?: number; tax_rate?: number; reason?: string
  }>
}
