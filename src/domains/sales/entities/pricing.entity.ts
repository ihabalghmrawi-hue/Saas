export interface SalesPricingRuleEntity extends Record<string, unknown> {
  id: string; company_id: string; code: string; name: string; name_ar?: string
  type: string; priority: number; is_active: boolean; apply_to: string; apply_value?: string
  discount_type: string; discount_value: number; min_qty?: number; max_discount_amount?: number
  valid_from?: string; valid_to?: string; days_of_week?: number[]
  metadata?: Record<string, unknown>; created_at: string; updated_at: string
}
