export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

export type AccountLevel = 1 | 2 | 3 | 4
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'cogs' | 'expense'
export type NormalBalance = 'debit' | 'credit'
export type JournalStatus = 'draft' | 'pending' | 'approved' | 'posted' | 'reversed' | 'void'
export type PeriodStatus = 'open' | 'closed' | 'locked'
export type FiscalYearStatus = 'draft' | 'active' | 'open' | 'closed'

export type AccountingEventType =
  | 'sale_cash' | 'sale_credit' | 'sale_cogs' | 'sale_payment'
  | 'sale_return_cash' | 'sale_return_credit' | 'sale_return_cogs'
  | 'purchase_cash' | 'purchase_credit' | 'purchase_payment'
  | 'expense_cash' | 'expense_accrual'
  | 'treasury_transfer' | 'rental_revenue'
  | 'inventory_adjustment' | 'construction_expense'
  | 'customer_payment' | 'supplier_payment' | 'payroll'
  | 'manual'

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
export type ReconciliationStatus = 'unmatched' | 'partial' | 'matched' | 'overpaid'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type Severity = 'info' | 'warning' | 'error' | 'critical'
