export interface CustomerCreditLimitEntity extends Record<string, unknown> {
  id: string; company_id: string; customer_id: string; credit_limit: number; current_balance: number
  currency: string; payment_terms: number; is_active: boolean; risk_score: string
  last_reviewed_at?: string; reviewed_by?: string; metadata?: Record<string, unknown>
  created_at: string; updated_at: string
}
