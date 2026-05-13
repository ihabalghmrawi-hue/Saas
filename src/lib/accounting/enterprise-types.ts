// ============================================================
// Enterprise Accounting — Enhanced Type Definitions
// ============================================================

// ── Posting Rules ─────────────────────────────────────────────
export interface PostingRule {
  id:          string
  company_id:  string
  name:        string
  name_ar?:    string
  event_type:  string
  description?: string
  is_active:   boolean
  priority:    number
  lines?:      PostingRuleLine[]
  created_at?: string
}

export interface PostingRuleLine {
  id:                string
  posting_rule_id:   string
  sequence:          number
  debit_account_id?: string
  credit_account_id?: string
  condition_field?:  string
  condition_operator?: string
  condition_value?:  string
  amount_percent:    number
  amount_fixed:      number
  description?:      string
}

// ── Account Mappings ─────────────────────────────────────────
export interface AccountMapping {
  id:                string
  company_id:        string
  event_type:        string
  debit_account_id:  string
  credit_account_id: string
  tax_account_id?:   string
  tax_rate:          number
  description?:      string
  is_active:         boolean
}

// ── Reconciliation ───────────────────────────────────────────
export type ReconciliationStatus = 'unmatched' | 'partial' | 'matched' | 'overpaid'

export interface Reconciliation {
  id:               string
  company_id:       string
  account_id:       string
  reference_type:   string
  reference_id?:    string
  reference_number?: string
  statement_date:   string
  statement_amount: number
  cleared_amount:   number
  difference:       number
  status:           ReconciliationStatus
  notes?:           string
  reconciled_at?:   string
  reconciled_by?:   string
  created_at?:      string
  lines?:           ReconciliationLine[]
}

export interface ReconciliationLine {
  id:                string
  reconciliation_id: string
  journal_entry_id?: string
  invoice_id?:       string
  payment_id?:       string
  amount:            number
  matched_amount:    number
  difference:        number
  status:            'partial' | 'matched'
  notes?:            string
}

// ── Recurring Journals ──────────────────────────────────────
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface RecurringJournal {
  id:                string
  company_id:        string
  name:              string
  name_ar?:          string
  description?:      string
  frequency:         RecurringFrequency
  interval_days?:    number
  day_of_month?:     number
  day_of_week?:      number
  month_of_year?:    number
  start_date:        string
  end_date?:         string
  next_run_date?:    string
  last_run_date?:    string
  total_runs:        number
  max_runs?:         number
  status:            'active' | 'paused' | 'completed' | 'cancelled'
  template_lines:    RecurringJournalLine[]
  is_auto_post:      boolean
  created_by?:       string
  created_at?:       string
}

export interface RecurringJournalLine {
  account_code: string
  debit:        number
  credit:       number
  description?: string
}

export interface RecurringJournalLog {
  id:                   string
  recurring_journal_id: string
  journal_entry_id?:    string
  run_date:             string
  status:               'success' | 'failed' | 'skipped'
  error_message?:       string
  created_at?:          string
}

// ── Branch ──────────────────────────────────────────────────
export interface Branch {
  id:         string
  company_id: string
  code:       string
  name:       string
  name_ar?:   string
  address?:   string
  phone?:     string
  is_active:  boolean
}

// ── Cost Center ─────────────────────────────────────────────
export interface CostCenter {
  id:         string
  company_id: string
  code:       string
  name:       string
  name_ar?:   string
  parent_id?: string
  is_active:  boolean
  children?:  CostCenter[]
}

export interface CostCenterAllocationRule {
  id:               string
  company_id:       string
  cost_center_id:   string
  account_id?:      string
  allocation_type:  'percentage' | 'fixed' | 'equal'
  allocation_value: number
  is_active:        boolean
}

// ── Approval Workflow ───────────────────────────────────────
export interface ApprovalWorkflow {
  id:                 string
  company_id:         string
  name:               string
  name_ar?:           string
  trigger_event:      string
  min_amount:         number
  max_amount:         number
  required_approvals: number
  is_active:          boolean
}

export interface JournalApproval {
  id:               string
  journal_entry_id: string
  company_id:       string
  approver_id?:     string
  status:           'pending' | 'approved' | 'rejected'
  comment?:         string
  approved_at?:     string
}

// ── Audit Trail ────────────────────────────────────────────
export type AuditAction = 'created' | 'modified' | 'posted' | 'reversed' | 'voided' | 'approved' | 'rejected' | 'edited'

export interface JournalAuditEntry {
  id:               string
  journal_entry_id: string
  company_id:       string
  action:           AuditAction
  old_values?:      Record<string, unknown>
  new_values?:      Record<string, unknown>
  performed_by?:    string
  performed_at:     string
  ip_address?:      string
  user_agent?:      string
}

// ── Aged Reports ───────────────────────────────────────────
export interface AgedItem {
  account_id:       string
  company_id:       string
  code:             string
  account_name:     string
  invoice_date:     string
  journal_entry_id: string
  entry_number:     string
  reference?:       string
  amount:           number
  days_overdue:     number
  aging_bucket:     '0-30' | '31-60' | '61-90' | '90+'
}

export interface AgedReport {
  as_of_date:      string
  total_0_30:      number
  total_31_60:     number
  total_61_90:     number
  total_90_plus:   number
  grand_total:     number
  buckets: {
    '0-30':  AgedItem[]
    '31-60': AgedItem[]
    '61-90': AgedItem[]
    '90+':   AgedItem[]
  }
}

// ── Integrity Check ────────────────────────────────────────
export interface IntegrityCheck {
  id:         string
  company_id: string
  check_type: string
  status:     'passed' | 'failed' | 'warning'
  details:    Record<string, unknown>
  checked_at: string
}

// ── AI Accounting ──────────────────────────────────────────
export interface JournalSuggestion {
  confidence:     number
  description:    string
  lines:          Array<{ account_code: string; debit: number; credit: number; description?: string }>
  source_document?: string
  reason:         string
}

export interface AnomalyResult {
  type:        'unusual_amount' | 'unusual_account' | 'unusual_frequency' | 'broken_balance'
  severity:    'low' | 'medium' | 'high'
  message:     string
  details:     Record<string, unknown>
  suggestion?: string
}

export interface AutoCategorizationResult {
  confidence:      number
  suggested_code:  string
  suggested_name:  string
  reason:          string
}
