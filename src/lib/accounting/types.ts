// ============================================================
// Accounting Engine — Type Definitions
// ============================================================

export type AccountLevel = 1 | 2 | 3

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'cogs' | 'expense'

export type NormalBalance = 'debit' | 'credit'

export type JournalStatus = 'draft' | 'pending' | 'approved' | 'posted' | 'reversed' | 'void'

// ── Fiscal Year ───────────────────────────────────────────────
export interface FiscalYear {
  id:         string
  company_id: string
  name:       string
  start_date: string
  end_date:   string
  status:     'open' | 'closed' | 'draft' | 'active'
  is_current: boolean
  created_at?: string
}

// ── Accounting Period ─────────────────────────────────────────
export interface AccountingPeriod {
  id:             string
  company_id:     string
  fiscal_year_id: string
  period_number:  number
  name:           string
  start_date:     string
  end_date:       string
  status:         'open' | 'closed'
  created_at?:    string
}

// ── Chart of Accounts Entry ───────────────────────────────────
export interface ChartOfAccountsEntry {
  id:               string
  company_id:       string
  code:             string
  name:             string
  name_ar:          string
  type:             AccountType
  subtype?:         string
  parent_id?:       string | null
  level:            AccountLevel
  is_postable:      boolean
  is_header:        boolean
  normal_balance:   NormalBalance
  current_balance:  number
  account_group?:   string
  is_active:        boolean
  is_system?:       boolean
  description?:     string
  children?:        ChartOfAccountsEntry[]
}

// ── Journal Line ──────────────────────────────────────────────
export interface JournalLine {
  account_code:    string
  account_id?:     string
  debit:           number
  credit:          number
  description?:    string
  cost_center_id?: string
}

// ── Journal Entry Input ───────────────────────────────────────
export interface JournalEntryInput {
  company_id:       string
  description:      string
  description_ar?:  string
  reference?:       string
  source?:          string
  source_id?:       string
  source_document?: string
  date?:            string
  fiscal_year_id?:  string
  period_id?:       string
  lines:            JournalLine[]
  auto_generated?:  boolean
}

// ── Posting Result ────────────────────────────────────────────
export interface PostingResult {
  ok:                boolean
  error?:            string
  journal_id?:       string
  entry_number?:     string
  accounts_created?: boolean
}

// ── Trial Balance Line ────────────────────────────────────────
export interface TrialBalanceLine {
  account_id:      string
  code:            string
  name:            string
  name_ar:         string
  type:            AccountType
  opening_debit:   number
  opening_credit:  number
  period_debit:    number
  period_credit:   number
  closing_debit:   number
  closing_credit:  number
  balance:         number
}

// ── Income Statement ──────────────────────────────────────────
export interface IncomeStatement {
  revenue:             StatementLine[]
  cogs:                StatementLine[]
  gross_profit:        number
  operating_expenses:  StatementLine[]
  operating_income:    number
  other_income:        StatementLine[]
  net_income:          number
  period_from:         string
  period_to:           string
}

// ── Balance Sheet ─────────────────────────────────────────────
export interface BalanceSheet {
  assets: {
    current:      StatementLine[]
    fixed:        StatementLine[]
    total_assets: number
  }
  liabilities: {
    current:           StatementLine[]
    long_term:         StatementLine[]
    total_liabilities: number
  }
  equity: {
    capital:          number
    retained_earnings: number
    net_income:       number
    total_equity:     number
  }
  period_date: string
}

// ── Statement Line ────────────────────────────────────────────
export interface StatementLine {
  code:       string
  name:       string
  name_ar:    string
  amount:     number
  children?:  StatementLine[]
}

// ── Cash Flow Statement ───────────────────────────────────────
export interface CashFlowStatement {
  operating:  { items: StatementLine[]; total: number }
  investing:  { items: StatementLine[]; total: number }
  financing:  { items: StatementLine[]; total: number }
  net_change: number
  period_from: string
  period_to:   string
}

// ── Auto Post Codes constant ──────────────────────────────────
export const AUTO_POST_CODES = {
  CASH:             '1101',
  BANK:             '1102',
  RECEIVABLE:       '1110',
  INVENTORY:        '1120',
  PREPAID:          '1130',
  INPUT_VAT:        '1140',
  EQUIPMENT:        '1201',
  PAYABLE:          '2101',
  VAT_PAYABLE:      '2103',
  ACCRUED_EXP:      '2104',
  SALARIES_PAYABLE: '2106',
  CAPITAL:          '3001',
  RETAINED:         '3002',
  INCOME_SUMMARY:   '3099',
  SALES:            '4001',
  SALES_RETURNS:    '4002',
  COGS:             '5001',
  PURCHASES:        '5002',
  PURCHASE_RETURNS: '5003',
  SALARIES_EXP:     '6101',
  RENT:             '6201',
  UTILITIES:        '6202',
  MARKETING:        '6301',
  BANK_CHARGES:     '6402',
  MISC_EXP:         '6501',
  INV_WRITEOFF:     '6502',
} as const
