export interface CustomerPaymentEntity extends Record<string, unknown> {
  id: string; company_id: string; payment_no: string; customer_id: string; customer_name?: string
  payment_type: string; payment_date: string; amount: number; allocated_amount: number
  currency: string; reference?: string; cheque_no?: string; cheque_date?: string; bank_account?: string
  notes?: string; status: string; posted_at?: string; posted_by?: string; reconciled: boolean
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}

export interface PaymentAllocationEntity extends Record<string, unknown> {
  id: string; payment_id: string; company_id: string; invoice_id?: string; credit_note_id?: string
  amount: number; allocated_at: string; metadata?: Record<string, unknown>
}

export interface CreatePaymentInput {
  customer_id: string; customer_name?: string; payment_type: string; payment_date?: string
  amount: number; currency?: string; reference?: string; cheque_no?: string; cheque_date?: string
  bank_account?: string; notes?: string; created_by?: string; metadata?: Record<string, unknown>
  allocations?: Array<{ invoice_id?: string; credit_note_id?: string; amount: number }>
}
