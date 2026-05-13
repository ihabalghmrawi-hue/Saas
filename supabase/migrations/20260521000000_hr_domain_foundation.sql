-- ============================================================
-- HR & Payroll Domain Foundation
-- Tables: employees, contracts, documents, departments, positions,
--         shifts, attendance, leaves, payroll, loans, overtime
-- ============================================================

-- 1. DEPARTMENTS
CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id),
  name        text NOT NULL,
  name_ar     text NOT NULL,
  code        text NOT NULL,
  parent_id   uuid REFERENCES departments(id),
  manager_id  uuid,
  cost_center_id uuid,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_departments_company ON departments(company_id);
CREATE UNIQUE INDEX idx_departments_code_company ON departments(company_id, code);

-- 2. POSITIONS
CREATE TABLE positions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id),
  department_id uuid NOT NULL REFERENCES departments(id),
  title         text NOT NULL,
  title_ar      text NOT NULL,
  code          text NOT NULL,
  grade         text,
  level         int,
  min_salary    numeric(14,2),
  max_salary    numeric(14,2),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_positions_company ON positions(company_id);
CREATE INDEX idx_positions_department ON positions(department_id);
CREATE UNIQUE INDEX idx_positions_code_company ON positions(company_id, code);

-- 3. EMPLOYEES
CREATE TABLE employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id),
  employee_no   text NOT NULL,
  full_name     text NOT NULL,
  full_name_ar  text NOT NULL,
  email         text,
  phone         text,
  gender        text NOT NULL CHECK (gender IN ('male','female')),
  marital_status text CHECK (marital_status IN ('single','married','divorced','widowed')),
  nationality   text,
  id_number     text,
  passport_number text,
  date_of_birth date,
  hire_date     date NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','terminated','resigned','retired','on_leave')),
  department_id uuid REFERENCES departments(id),
  position_id   uuid REFERENCES positions(id),
  branch_id     uuid,
  cost_center_id uuid,
  reports_to    uuid REFERENCES employees(id),
  grade         text,
  level         int,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_status ON employees(company_id, status);
CREATE UNIQUE INDEX idx_employees_no_company ON employees(company_id, employee_no);

-- 4. EMPLOYEE_CONTRACTS
CREATE TABLE employee_contracts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  contract_type text NOT NULL CHECK (contract_type IN ('permanent','fixed_term','probation','trainee','outsourced')),
  start_date date NOT NULL,
  end_date   date,
  probation_end_date date,
  basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(14,2) NOT NULL DEFAULT 0,
  transportation_allowance numeric(14,2) NOT NULL DEFAULT 0,
  communication_allowance numeric(14,2) NOT NULL DEFAULT 0,
  cost_of_living_allowance numeric(14,2) NOT NULL DEFAULT 0,
  other_allowances numeric(14,2) NOT NULL DEFAULT 0,
  total_salary numeric(14,2) GENERATED ALWAYS AS (
    basic_salary + housing_allowance + transportation_allowance
    + communication_allowance + cost_of_living_allowance + other_allowances
  ) STORED,
  bank_name text,
  bank_account text,
  iban text,
  is_active boolean NOT NULL DEFAULT true,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_contracts_employee ON employee_contracts(employee_id);
CREATE INDEX idx_emp_contracts_active ON employee_contracts(employee_id) WHERE is_active = true;

-- 5. EMPLOYEE_DOCUMENTS
CREATE TABLE employee_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id),
  employee_id   uuid NOT NULL REFERENCES employees(id),
  document_type text NOT NULL,
  document_name text NOT NULL,
  file_url      text NOT NULL,
  expiry_date   date,
  is_verified   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_docs_employee ON employee_documents(employee_id);

-- 6. SHIFTS
CREATE TABLE shifts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES companies(id),
  name                    text NOT NULL,
  name_ar                 text NOT NULL,
  shift_type              text NOT NULL CHECK (shift_type IN ('fixed','rotating','flexible','split')),
  start_time              time NOT NULL,
  end_time                time NOT NULL,
  late_grace_minutes      int NOT NULL DEFAULT 15,
  early_leave_grace_minutes int NOT NULL DEFAULT 15,
  break_start             time,
  break_end               time,
  break_duration_minutes  int NOT NULL DEFAULT 0,
  working_hours numeric(5,2) GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 - (break_duration_minutes::numeric / 60)
  ) STORED,
  is_night_shift          boolean NOT NULL DEFAULT false,
  applies_on_friday       boolean NOT NULL DEFAULT true,
  applies_on_saturday     boolean NOT NULL DEFAULT true,
  applies_on_sunday       boolean NOT NULL DEFAULT true,
  applies_on_monday       boolean NOT NULL DEFAULT true,
  applies_on_tuesday      boolean NOT NULL DEFAULT true,
  applies_on_wednesday    boolean NOT NULL DEFAULT true,
  applies_on_thursday     boolean NOT NULL DEFAULT true,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shifts_company ON shifts(company_id);

-- 7. SHIFT_ASSIGNMENTS
CREATE TABLE shift_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id),
  employee_id   uuid NOT NULL REFERENCES employees(id),
  shift_id      uuid NOT NULL REFERENCES shifts(id),
  effective_from date NOT NULL,
  effective_to  date,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shift_assignments_emp ON shift_assignments(employee_id, effective_from);

-- 8. HOLIDAY_CALENDARS
CREATE TABLE holiday_calendars (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name       text NOT NULL,
  name_ar    text NOT NULL,
  year       int NOT NULL,
  entries    jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_holiday_cal_year_company ON holiday_calendars(company_id, year);

-- 9. ATTENDANCE_LOGS
CREATE TABLE attendance_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  employee_id       uuid NOT NULL REFERENCES employees(id),
  date              date NOT NULL,
  check_in          timestamptz,
  check_out         timestamptz,
  status            text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','early_leave','half_day','holiday','weekend')),
  shift_id          uuid REFERENCES shifts(id),
  shift_start       time,
  shift_end         time,
  late_minutes      int NOT NULL DEFAULT 0,
  early_leave_minutes int NOT NULL DEFAULT 0,
  working_minutes   int NOT NULL DEFAULT 0,
  overtime_minutes  int NOT NULL DEFAULT 0,
  break_minutes     int NOT NULL DEFAULT 0,
  source            text,
  verified_by       uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_attendance_emp_date ON attendance_logs(company_id, employee_id, date);
CREATE INDEX idx_attendance_date_range ON attendance_logs(company_id, date);

-- 10. ATTENDANCE_SESSIONS
CREATE TABLE attendance_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  employee_id       uuid NOT NULL REFERENCES employees(id),
  attendance_log_id uuid NOT NULL REFERENCES attendance_logs(id),
  check_in          timestamptz NOT NULL,
  check_out         timestamptz,
  check_in_method   text,
  check_out_method  text,
  duration_minutes  int,
  device_id         text,
  location          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_att_sessions_log ON attendance_sessions(attendance_log_id);

-- 11. LEAVE_TYPES
CREATE TABLE leave_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id),
  name                  text NOT NULL,
  name_ar               text NOT NULL,
  leave_type            text NOT NULL CHECK (leave_type IN ('annual','sick','unpaid','maternity','paternity','hajj','emergency','compassionate','study','sabbatical')),
  days_per_year         int NOT NULL DEFAULT 0,
  is_paid               boolean NOT NULL DEFAULT true,
  is_carry_forward      boolean NOT NULL DEFAULT false,
  carry_forward_limit   int NOT NULL DEFAULT 0,
  requires_approval     boolean NOT NULL DEFAULT true,
  min_days              int NOT NULL DEFAULT 1,
  max_days_per_request  int NOT NULL DEFAULT 30,
  allow_half_day        boolean NOT NULL DEFAULT false,
  requires_document     boolean NOT NULL DEFAULT false,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_types_company ON leave_types(company_id);

-- 12. LEAVE_REQUESTS
CREATE TABLE leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  employee_id     uuid NOT NULL REFERENCES employees(id),
  leave_type_id   uuid NOT NULL REFERENCES leave_types(id),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  total_days      int NOT NULL,
  is_half_day     boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason          text,
  attachment_url  text,
  approved_by     uuid,
  approved_at     timestamptz,
  rejected_reason text,
  encashed        boolean NOT NULL DEFAULT false,
  encashment_amount numeric(14,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_requests_emp ON leave_requests(employee_id, status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(company_id, start_date, end_date);

-- 13. LEAVE_BALANCES
CREATE TABLE leave_balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  employee_id     uuid NOT NULL REFERENCES employees(id),
  leave_type_id   uuid NOT NULL REFERENCES leave_types(id),
  year            int NOT NULL,
  entitled_days   int NOT NULL DEFAULT 0,
  taken_days      int NOT NULL DEFAULT 0,
  pending_days    int NOT NULL DEFAULT 0,
  remaining_days  int NOT NULL DEFAULT 0,
  carried_over    int NOT NULL DEFAULT 0,
  encashed_days   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_leave_balance_unique ON leave_balances(company_id, employee_id, leave_type_id, year);

-- 14. PAYROLL_CYCLES
CREATE TABLE payroll_cycles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id),
  name         text NOT NULL,
  cycle_type   text NOT NULL CHECK (cycle_type IN ('monthly','semi_monthly','weekly','bi_weekly')),
  year         int NOT NULL,
  month        int NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  payment_date date NOT NULL,
  is_closed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_payroll_cycle_unique ON payroll_cycles(company_id, year, month, cycle_type);

-- 15. PAYROLL_RUNS (immutable after locking)
CREATE TABLE payroll_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES companies(id),
  cycle_id                uuid NOT NULL REFERENCES payroll_cycles(id),
  name                    text NOT NULL,
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','completed','locked','reversed')),
  branch_id               uuid,
  total_earnings          numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions        numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_contributions numeric(14,2) NOT NULL DEFAULT 0,
  net_pay                 numeric(14,2) NOT NULL DEFAULT 0,
  employee_count          int NOT NULL DEFAULT 0,
  is_correction           boolean NOT NULL DEFAULT false,
  corrected_run_id        uuid REFERENCES payroll_runs(id),
  reversal_run_id         uuid REFERENCES payroll_runs(id),
  posted_to_gl            boolean NOT NULL DEFAULT false,
  gl_journal_entry_id     text,
  processed_by            uuid,
  processed_at            timestamptz,
  approved_by             uuid,
  approved_at             timestamptz,
  locked_by               uuid,
  locked_at               timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_runs_cycle ON payroll_runs(cycle_id);
CREATE INDEX idx_payroll_runs_company ON payroll_runs(company_id, status);

-- 16. PAYROLL_LINES
CREATE TABLE payroll_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  run_id          uuid NOT NULL REFERENCES payroll_runs(id),
  employee_id     uuid NOT NULL REFERENCES employees(id),
  line_type       text NOT NULL CHECK (line_type IN ('earning','deduction','employer_contribution')),
  category        text NOT NULL,
  name            text NOT NULL,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  is_taxable      boolean NOT NULL DEFAULT false,
  is_employer_contribution boolean NOT NULL DEFAULT false,
  cost_center_id  uuid,
  branch_id       uuid,
  gl_account_code text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_lines_run ON payroll_lines(run_id);
CREATE INDEX idx_payroll_lines_employee ON payroll_lines(run_id, employee_id);

-- 17. PAYROLL_SUMMARIES
CREATE TABLE payroll_summaries (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid NOT NULL REFERENCES companies(id),
  run_id                    uuid NOT NULL REFERENCES payroll_runs(id),
  employee_id               uuid NOT NULL REFERENCES employees(id),
  basic_salary              numeric(14,2) NOT NULL DEFAULT 0,
  housing_allowance         numeric(14,2) NOT NULL DEFAULT 0,
  transportation_allowance  numeric(14,2) NOT NULL DEFAULT 0,
  communication_allowance   numeric(14,2) NOT NULL DEFAULT 0,
  cost_of_living_allowance  numeric(14,2) NOT NULL DEFAULT 0,
  other_allowances          numeric(14,2) NOT NULL DEFAULT 0,
  overtime_amount           numeric(14,2) NOT NULL DEFAULT 0,
  bonuses                   numeric(14,2) NOT NULL DEFAULT 0,
  gross_pay                 numeric(14,2) NOT NULL DEFAULT 0,
  loan_deduction            numeric(14,2) NOT NULL DEFAULT 0,
  tax_deduction             numeric(14,2) NOT NULL DEFAULT 0,
  social_insurance          numeric(14,2) NOT NULL DEFAULT 0,
  medical_insurance         numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions          numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions          numeric(14,2) NOT NULL DEFAULT 0,
  net_pay                   numeric(14,2) NOT NULL DEFAULT 0,
  employer_contributions    numeric(14,2) NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_payroll_summary_unique ON payroll_summaries(run_id, employee_id);

-- 18. PAYROLL_ADJUSTMENTS
CREATE TABLE payroll_adjustments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  run_id          uuid REFERENCES payroll_runs(id),
  employee_id     uuid NOT NULL REFERENCES employees(id),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('earning','deduction')),
  category        text NOT NULL,
  name            text NOT NULL,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  is_recurring    boolean NOT NULL DEFAULT false,
  recurring_months int,
  is_taxable      boolean NOT NULL DEFAULT true,
  gl_account_code text,
  notes           text,
  approved_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_adjustments_emp ON payroll_adjustments(employee_id);

-- 19. PAYROLL_DEDUCTIONS (standing)
CREATE TABLE payroll_deductions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  name              text NOT NULL,
  name_ar           text NOT NULL,
  deduction_type    text NOT NULL CHECK (deduction_type IN ('tax','social_insurance','medical_insurance','loan','other')),
  calculation_method text NOT NULL CHECK (calculation_method IN ('percentage','fixed')),
  rate              numeric(5,2) NOT NULL DEFAULT 0,
  cap_amount        numeric(14,2),
  gl_account_code   text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_deductions_company ON payroll_deductions(company_id);

-- 20. PAYROLL_BENEFITS
CREATE TABLE payroll_benefits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  name              text NOT NULL,
  name_ar           text NOT NULL,
  benefit_type      text NOT NULL CHECK (benefit_type IN ('employer','employee')),
  calculation_method text NOT NULL CHECK (calculation_method IN ('percentage','fixed')),
  rate              numeric(5,2) NOT NULL DEFAULT 0,
  cap_amount        numeric(14,2),
  gl_account_code   text,
  gl_employer_code  text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_benefits_company ON payroll_benefits(company_id);

-- 21. EMPLOYEE_LOANS
CREATE TABLE employee_loans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id),
  employee_id         uuid NOT NULL REFERENCES employees(id),
  loan_date           date NOT NULL,
  total_amount        numeric(14,2) NOT NULL DEFAULT 0,
  installment_amount  numeric(14,2) NOT NULL DEFAULT 0,
  total_installments  int NOT NULL DEFAULT 1,
  paid_installments   int NOT NULL DEFAULT 0,
  remaining_amount    numeric(14,2) NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','defaulted','cancelled')),
  purpose             text,
  approved_by         uuid,
  approved_at         timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_loans_employee ON employee_loans(employee_id, status);

-- 22. LOAN_PAYMENTS
CREATE TABLE loan_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  loan_id           uuid NOT NULL REFERENCES employee_loans(id),
  employee_id       uuid NOT NULL REFERENCES employees(id),
  payroll_run_id    uuid REFERENCES payroll_runs(id),
  installment_number int NOT NULL,
  amount            numeric(14,2) NOT NULL DEFAULT 0,
  paid_at           timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);

-- 23. OVERTIME_ENTRIES
CREATE TABLE overtime_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  employee_id     uuid NOT NULL REFERENCES employees(id),
  date            date NOT NULL,
  overtime_type   text NOT NULL CHECK (overtime_type IN ('weekday','weekend','holiday','night')),
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  total_minutes   int NOT NULL,
  rate_multiplier numeric(3,1) NOT NULL DEFAULT 1.5,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by     uuid,
  approved_at     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_overtime_emp_date ON overtime_entries(employee_id, date);

-- 24. PAYROLL_ACCOUNTING_LINKS
CREATE TABLE payroll_accounting_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  run_id          uuid NOT NULL REFERENCES payroll_runs(id),
  journal_entry_id text NOT NULL,
  total_debit     numeric(14,2) NOT NULL DEFAULT 0,
  total_credit    numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed')),
  posted_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_acct_links_run ON payroll_accounting_links(run_id);
CREATE UNIQUE INDEX idx_payroll_acct_links_unique ON payroll_accounting_links(run_id);

-- 25. HR_INTEGRITY_LOGS
CREATE TABLE hr_integrity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id),
  entity_type text NOT NULL,
  entity_id   uuid,
  severity    text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  issue       text NOT NULL,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_integrity_company ON hr_integrity_logs(company_id, severity);

-- ============================================================
-- AUDIT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION hr_audit_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_audit BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION hr_audit_trigger();
CREATE TRIGGER trg_employee_contracts_audit BEFORE UPDATE ON employee_contracts
  FOR EACH ROW EXECUTE FUNCTION hr_audit_trigger();
CREATE TRIGGER trg_leave_balances_audit BEFORE UPDATE ON leave_balances
  FOR EACH ROW EXECUTE FUNCTION hr_audit_trigger();

-- ============================================================
-- IMMUTABLE PAYROLL POSTING TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_payroll_run_modification()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'locked' AND NEW.status != 'reversed' THEN
    RAISE EXCEPTION 'لا يمكن تعديل شغيلة رواتب مقفلة' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.posted_to_gl = true AND NEW.posted_to_gl = true AND OLD.gl_journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'تم ترحيل شغيلة الرواتب إلى الحسابات مسبقاً' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payroll_runs_immutable BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION prevent_payroll_run_modification();

-- ============================================================
-- IDEMPOTENCY — prevent duplicate payroll runs per cycle/branch
-- ============================================================
CREATE UNIQUE INDEX idx_payroll_run_unique
  ON payroll_runs(company_id, cycle_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status != 'reversed';

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_accounting_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_integrity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON departments
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON positions
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON employees
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON employee_contracts
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON employee_documents
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON shifts
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON shift_assignments
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON holiday_calendars
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON attendance_logs
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON attendance_sessions
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON leave_types
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON leave_requests
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON leave_balances
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_cycles
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_runs
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_lines
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_summaries
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_adjustments
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_deductions
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_benefits
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON employee_loans
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON loan_payments
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON overtime_entries
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON payroll_accounting_links
  USING (company_id = current_company_id()::uuid);
CREATE POLICY tenant_isolation_policy ON hr_integrity_logs
  USING (company_id = current_company_id()::uuid);
