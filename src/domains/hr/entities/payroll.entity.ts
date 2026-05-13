import type { PayrollCycleType, PayrollRunStatus, PayrollLineType, LoanStatus } from '../types'

export interface PayrollCycleEntity {
  id: string
  company_id: string
  name: string
  cycle_type: PayrollCycleType
  year: number
  month: number
  period_start: string
  period_end: string
  payment_date: string
  is_closed: boolean
  created_at: string
}

export interface PayrollRunEntity {
  id: string
  company_id: string
  cycle_id: string
  name: string
  status: PayrollRunStatus
  branch_id: string | null
  total_earnings: number
  total_deductions: number
  total_employer_contributions: number
  net_pay: number
  employee_count: number
  is_correction: boolean
  corrected_run_id: string | null
  reversal_run_id: string | null
  posted_to_gl: boolean
  gl_journal_entry_id: string | null
  processed_by: string | null
  processed_at: string | null
  approved_by: string | null
  approved_at: string | null
  locked_by: string | null
  locked_at: string | null
  notes: string | null
  created_at: string
}

export interface PayrollLineEntity {
  id: string
  company_id: string
  run_id: string
  employee_id: string
  line_type: PayrollLineType
  category: string
  name: string
  amount: number
  is_taxable: boolean
  is_employer_contribution: boolean
  cost_center_id: string | null
  branch_id: string | null
  gl_account_code: string | null
  notes: string | null
  created_at: string
}

export interface PayrollSummaryEntity {
  id: string
  company_id: string
  run_id: string
  employee_id: string
  basic_salary: number
  housing_allowance: number
  transportation_allowance: number
  communication_allowance: number
  cost_of_living_allowance: number
  other_allowances: number
  overtime_amount: number
  bonuses: number
  gross_pay: number
  loan_deduction: number
  tax_deduction: number
  social_insurance: number
  medical_insurance: number
  other_deductions: number
  total_deductions: number
  net_pay: number
  employer_contributions: number
  created_at: string
}

export interface PayrollAdjustmentEntity {
  id: string
  company_id: string
  run_id: string | null
  employee_id: string
  adjustment_type: 'earning' | 'deduction'
  category: string
  name: string
  amount: number
  is_recurring: boolean
  recurring_months: number | null
  is_taxable: boolean
  gl_account_code: string | null
  notes: string | null
  approved_by: string | null
  created_at: string
}

export interface PayrollBenefitEntity {
  id: string
  company_id: string
  name: string
  name_ar: string
  benefit_type: 'employer' | 'employee'
  calculation_method: 'percentage' | 'fixed'
  rate: number
  cap_amount: number | null
  gl_account_code: string | null
  gl_employer_code: string | null
  is_active: boolean
  created_at: string
}

export interface LoanEntity {
  id: string
  company_id: string
  employee_id: string
  loan_date: string
  total_amount: number
  installment_amount: number
  total_installments: number
  paid_installments: number
  remaining_amount: number
  status: LoanStatus
  purpose: string | null
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
}

export interface LoanPaymentEntity {
  id: string
  company_id: string
  loan_id: string
  employee_id: string
  payroll_run_id: string | null
  installment_number: number
  amount: number
  paid_at: string
  created_at: string
}

export interface HrAccountingLinkEntity {
  id: string
  company_id: string
  run_id: string
  journal_entry_id: string
  total_debit: number
  total_credit: number
  status: 'pending' | 'posted' | 'reversed'
  posted_at: string | null
  created_at: string
}

export interface PayrollAccountMapping {
  salary_expense_code: string
  salary_payable_code: string
  tax_payable_code: string
  social_insurance_code: string
  medical_insurance_code: string
  loan_receivable_code: string
  employer_contribution_expense_code: string
}

export interface CreatePayrollRunInput {
  cycle_id: string
  branch_id?: string
  employee_ids?: string[]
  notes?: string
}

export interface CreateLoanInput {
  employee_id: string
  total_amount: number
  installment_amount: number
  total_installments: number
  purpose?: string
  notes?: string
}

export interface CreatePayrollAdjustmentInput {
  employee_id: string
  adjustment_type: 'earning' | 'deduction'
  category: string
  name: string
  amount: number
  is_recurring?: boolean
  recurring_months?: number
  is_taxable?: boolean
  gl_account_code?: string
  notes?: string
}
