export interface CustomerWalletEntity extends Record<string, unknown> {
  id: string; company_id: string; customer_id: string; balance: number
  credit_limit: number; currency: string; is_active: boolean
  created_at: string; updated_at: string
}

export interface WalletTransactionEntity extends Record<string, unknown> {
  id: string; wallet_id: string; company_id: string; type: string
  amount: number; balance_before: number; balance_after: number
  reference_type?: string; reference_id?: string; description?: string
  metadata?: Record<string, unknown>; created_at: string
}
