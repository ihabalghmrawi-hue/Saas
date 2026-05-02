export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Company {
  id: string
  name: string
  name_ar?: string
  slug: string
  logo_url?: string
  currency: string
  language: string
  timezone: string
  fiscal_year_start: number
  address?: string
  phone?: string
  email?: string
  tax_number?: string
  settings: CompanySettings
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  theme: 'light' | 'dark'
  notifications_enabled: boolean
  backup_enabled: boolean
  date_format: string
  number_format: string
}

export interface Membership {
  id: string
  user_id: string
  company_id: string
  role: 'owner' | 'admin' | 'accountant' | 'viewer'
  is_active: boolean
  joined_at: string
  created_at: string
}

export interface Category {
  id: string
  company_id: string
  name: string
  name_ar?: string
  type: 'income' | 'expense' | 'both'
  icon?: string
  color: string
  parent_id?: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Account {
  id: string
  company_id: string
  code: string
  name: string
  name_ar?: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  subtype?: string
  parent_id?: string
  normal_balance: 'debit' | 'credit'
  current_balance: number
  is_active: boolean
  is_system: boolean
  description?: string
  created_at: string
  updated_at: string
}

export interface Party {
  id: string
  company_id: string
  name: string
  name_ar?: string
  type: 'customer' | 'supplier' | 'employee' | 'other'
  email?: string
  phone?: string
  address?: string
  tax_number?: string
  credit_limit: number
  current_balance: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  company_id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  exchange_rate: number
  category_id?: string
  account_id?: string
  party_id?: string
  reference_number?: string
  description?: string
  description_ar?: string
  transaction_date: string
  payment_method: string
  status: 'pending' | 'completed' | 'cancelled' | 'draft'
  attachments: Json[]
  tags?: string[]
  created_by?: string
  created_at: string
  updated_at: string
  // Relations
  category?: Category
  party?: Party
  account?: Account
}

export interface JournalEntry {
  id: string
  company_id: string
  entry_number: string
  date: string
  description: string
  description_ar?: string
  reference?: string
  transaction_id?: string
  status: 'draft' | 'posted' | 'reversed'
  total_debit: number
  total_credit: number
  is_balanced: boolean
  created_by?: string
  created_at: string
  updated_at: string
  // Relations
  lines?: JournalEntryLine[]
}

export interface JournalEntryLine {
  id: string
  journal_entry_id: string
  account_id: string
  debit: number
  credit: number
  description?: string
  line_number: number
  created_at: string
  // Relations
  account?: Account
}

export interface Wallet {
  id: string
  company_id: string
  name: string
  name_ar?: string
  type: 'cash' | 'bank' | 'digital'
  currency: string
  initial_balance: number
  current_balance: number
  account_number?: string
  bank_name?: string
  is_active: boolean
  is_default: boolean
  icon: string
  color: string
  created_at: string
  updated_at: string
}

export interface WalletTransaction {
  id: string
  wallet_id: string
  company_id: string
  transaction_id?: string
  type: 'in' | 'out' | 'transfer'
  amount: number
  balance_after: number
  description?: string
  reference?: string
  transfer_to_wallet_id?: string
  created_at: string
}

// Dashboard Types
export interface DashboardStats {
  totalBalance: number
  totalIncome: number
  totalExpenses: number
  netProfit: number
  incomeChange: number
  expenseChange: number
  profitChange: number
}

export interface MonthlyData {
  month: string
  income: number
  expenses: number
  profit: number
}

export interface TransactionFilter {
  type?: 'income' | 'expense' | 'transfer' | 'all'
  category_id?: string
  date_from?: string
  date_to?: string
  search?: string
  status?: string
  page?: number
  limit?: number
}

export interface ReportData {
  period: {
    start: string
    end: string
    label: string
  }
  summary: {
    totalIncome: number
    totalExpenses: number
    netProfit: number
    profitMargin: number
  }
  incomeByCategory: CategoryBreakdown[]
  expensesByCategory: CategoryBreakdown[]
  monthlyTrend: MonthlyData[]
}

export interface CategoryBreakdown {
  category: string
  category_ar: string
  amount: number
  percentage: number
  color: string
  icon?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}
