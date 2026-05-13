-- ============================================================
-- Enterprise Accounting Engine — Full Infrastructure
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ── 1. ENHANCE EXISTING TABLES ──────────────────────────────

-- journal_entries: add approval workflow columns
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approval_status    TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected'));
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_by_id     UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS rejection_reason   TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_reason    TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_by_id      UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_id          UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS cost_center_id     UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS currency           TEXT DEFAULT 'SAR';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS exchange_rate      DECIMAL(10,6) DEFAULT 1;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tags               TEXT[];

-- journal_entry_lines: add cost center and branch
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS cost_center_id    UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS branch_id         UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS line_number       INT;

-- accounts: add more columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS level             INT DEFAULT 3;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_postable       BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_header         BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_group     TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance   DECIMAL(15,2) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency          TEXT DEFAULT 'SAR';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tax_rate          DECIMAL(5,2) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_receivable     BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_payable        BOOLEAN DEFAULT false;

-- ── 2. POSTING RULES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posting_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  name              TEXT NOT NULL,
  name_ar           TEXT,
  event_type        TEXT NOT NULL,
  description       TEXT,
  is_active         BOOLEAN DEFAULT true,
  priority          INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- posting_rule_lines: debit/credit account mapping per rule
CREATE TABLE IF NOT EXISTS posting_rule_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_rule_id   UUID NOT NULL REFERENCES posting_rules(id) ON DELETE CASCADE,
  sequence          INT DEFAULT 0,
  debit_account_id  UUID,
  credit_account_id UUID,
  condition_field   TEXT,
  condition_operator TEXT,
  condition_value   TEXT,
  amount_percent    DECIMAL(5,2) DEFAULT 100,
  amount_fixed      DECIMAL(15,2) DEFAULT 0,
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. ACCOUNT MAPPINGS (enhanced) ───────────────────────────
CREATE TABLE IF NOT EXISTS account_mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  event_type        TEXT NOT NULL,
  debit_account_id  UUID NOT NULL REFERENCES accounts(id),
  credit_account_id UUID NOT NULL REFERENCES accounts(id),
  tax_account_id    UUID REFERENCES accounts(id),
  tax_rate          DECIMAL(5,2) DEFAULT 0,
  description       TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, event_type)
);

-- ── 4. RECONCILIATION ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  account_id        UUID NOT NULL REFERENCES accounts(id),
  reference_type    TEXT NOT NULL,
  reference_id      TEXT,
  reference_number  TEXT,
  statement_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  statement_amount  DECIMAL(15,2) NOT NULL,
  cleared_amount    DECIMAL(15,2) DEFAULT 0,
  difference        DECIMAL(15,2) GENERATED ALWAYS AS (statement_amount - cleared_amount) STORED,
  status            TEXT DEFAULT 'unmatched' CHECK (status IN ('unmatched','partial','matched','overpaid')),
  notes             TEXT,
  reconciled_at     TIMESTAMPTZ,
  reconciled_by     UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
  journal_entry_id  UUID REFERENCES journal_entries(id),
  invoice_id        TEXT,
  payment_id        TEXT,
  amount            DECIMAL(15,2) NOT NULL,
  matched_amount    DECIMAL(15,2) DEFAULT 0,
  difference        DECIMAL(15,2) GENERATED ALWAYS AS (amount - matched_amount) STORED,
  status            TEXT DEFAULT 'partial' CHECK (status IN ('partial','matched')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. RECURRING JOURNALS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_journals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  name              TEXT NOT NULL,
  name_ar           TEXT,
  description       TEXT,
  frequency         TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','custom')),
  interval_days     INT,
  day_of_month      INT,
  day_of_week       INT,
  month_of_year     INT,
  start_date        DATE NOT NULL,
  end_date          DATE,
  next_run_date     DATE,
  last_run_date     DATE,
  total_runs        INT DEFAULT 0,
  max_runs          INT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  template_lines    JSONB NOT NULL DEFAULT '[]',
  is_auto_post      BOOLEAN DEFAULT true,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_journal_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_journal_id UUID NOT NULL REFERENCES recurring_journals(id) ON DELETE CASCADE,
  journal_entry_id  UUID REFERENCES journal_entries(id),
  run_date          DATE NOT NULL,
  status            TEXT DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. BRANCHES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  name_ar           TEXT,
  address           TEXT,
  phone             TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ── 7. COST CENTERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_centers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  name_ar           TEXT,
  parent_id         UUID REFERENCES cost_centers(id),
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- cost_center_allocation_rules
CREATE TABLE IF NOT EXISTS cost_center_allocation_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  cost_center_id    UUID NOT NULL REFERENCES cost_centers(id),
  account_id        UUID REFERENCES accounts(id),
  allocation_type   TEXT NOT NULL CHECK (allocation_type IN ('percentage','fixed','equal')),
  allocation_value  DECIMAL(15,4) NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. APPROVAL WORKFLOW ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_workflows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  name              TEXT NOT NULL,
  name_ar           TEXT,
  trigger_event     TEXT NOT NULL,
  min_amount        DECIMAL(15,2) DEFAULT 0,
  max_amount        DECIMAL(15,2) DEFAULT 999999999.99,
  required_approvals INT DEFAULT 1,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL,
  approver_id       UUID,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  comment           TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. AUDIT TRAIL ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_audit_trail (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL,
  action            TEXT NOT NULL CHECK (action IN ('created','modified','posted','reversed','voided','approved','rejected','edited')),
  old_values        JSONB,
  new_values        JSONB,
  performed_by      UUID,
  performed_at      TIMESTAMPTZ DEFAULT NOW(),
  ip_address        TEXT,
  user_agent        TEXT
);

-- ── 10. FINANCIAL INTEGRITY ──────────────────────────────────
CREATE TABLE IF NOT EXISTS integrity_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  check_type        TEXT NOT NULL,
  status            TEXT DEFAULT 'passed' CHECK (status IN ('passed','failed','warning')),
  details           JSONB,
  checked_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. AI INSIGHTS ENHANCED ─────────────────────────────────
ALTER TABLE IF EXISTS ai_insights ADD COLUMN IF NOT EXISTS category    TEXT;
ALTER TABLE IF EXISTS ai_insights ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2) DEFAULT 0;
ALTER TABLE IF EXISTS ai_insights ADD COLUMN IF NOT EXISTS action_url TEXT;

-- ── 12. INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posting_rules_company     ON posting_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_posting_rules_event       ON posting_rules(company_id, event_type);
CREATE INDEX IF NOT EXISTS idx_posting_rule_lines_rule   ON posting_rule_lines(posting_rule_id);
CREATE INDEX IF NOT EXISTS idx_account_mappings_company  ON account_mappings(company_id, event_type);
CREATE INDEX IF NOT EXISTS idx_reconciliations_company   ON reconciliations(company_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_account   ON reconciliations(company_id, account_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_status    ON reconciliations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_lines_rec  ON reconciliation_lines(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_recurring_journals_company ON recurring_journals(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_journals_next   ON recurring_journals(next_run_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_branches_company           ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_company       ON cost_centers(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_center_rules_company  ON cost_center_allocation_rules(company_id, cost_center_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_company ON approval_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_approvals_entry    ON journal_approvals(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_approvals_pending  ON journal_approvals(company_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_journal_audit_entry        ON journal_audit_trail(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_audit_company      ON journal_audit_trail(company_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_integrity_checks_company   ON integrity_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_branch     ON journal_entries(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_cost_ctr   ON journal_entries(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_approval   ON journal_entries(approval_status) WHERE approval_status != 'approved';

-- ── 13. ENABLE RLS ──────────────────────────────────────────
ALTER TABLE posting_rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_rule_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_mappings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_lines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_journals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_journal_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_center_allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_approvals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_audit_trail          ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_checks             ENABLE ROW LEVEL SECURITY;

-- ── 14. RLS POLICIES (company-scoped) ────────────────────────
DO $$
DECLARE
  tables_with_company TEXT[] := ARRAY[
    'posting_rules', 'posting_rule_lines', 'account_mappings', 'reconciliations',
    'reconciliation_lines', 'recurring_journals', 'recurring_journal_log',
    'branches', 'cost_centers', 'cost_center_allocation_rules',
    'approval_workflows', 'journal_approvals', 'journal_audit_trail', 'integrity_checks'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables_with_company LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %s', t, t);

    EXECUTE format(
      'CREATE POLICY "%1$s_select" ON %1$s FOR SELECT TO authenticated USING (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_insert" ON %1$s FOR INSERT TO authenticated WITH CHECK (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_update" ON %1$s FOR UPDATE TO authenticated USING (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      ) WITH CHECK (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_delete" ON %1$s FOR DELETE TO authenticated USING (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
  END LOOP;
END $$;

-- ── 15. TRIGGER: audit trail on journal_entries change ───────
CREATE OR REPLACE FUNCTION journal_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Only log if significant fields changed
    IF v_old - 'updated_at' IS DISTINCT FROM v_new - 'updated_at' THEN
      INSERT INTO journal_audit_trail (
        journal_entry_id, company_id, action, old_values, new_values, performed_at
      ) VALUES (
        NEW.id, NEW.company_id, 'modified', v_old, v_new, NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS journal_audit_trigger ON journal_entries;
CREATE TRIGGER journal_audit_trigger
  AFTER UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_audit_trigger();

-- ── 16. INTEGRITY CHECK FUNCTIONS ───────────────────────────

-- Check unbalanced journal entries
CREATE OR REPLACE FUNCTION check_unbalanced_entries(p_company_id UUID)
RETURNS TABLE (entry_id UUID, entry_number TEXT, debit_diff NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT je.id, je.entry_number, ABS(je.total_debit - je.total_credit) AS diff
  FROM journal_entries je
  WHERE je.company_id = p_company_id
    AND je.status = 'posted'
    AND ABS(je.total_debit - je.total_credit) > 0.01;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check orphaned journal lines
CREATE OR REPLACE FUNCTION check_orphaned_lines(p_company_id UUID)
RETURNS TABLE (line_id UUID, journal_entry_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT jel.id, jel.journal_entry_id
  FROM journal_entry_lines jel
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get account balance at a point in time (function)
CREATE OR REPLACE FUNCTION get_account_balance_as_of(
  p_account_id UUID,
  p_company_id UUID,
  p_as_of_date DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_normal_balance TEXT;
  v_total_debit    NUMERIC := 0;
  v_total_credit   NUMERIC := 0;
BEGIN
  SELECT normal_balance INTO v_normal_balance
  FROM accounts WHERE id = p_account_id AND company_id = p_company_id;
  IF v_normal_balance IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(jel.debit), 0), COALESCE(SUM(jel.credit), 0)
  INTO v_total_debit, v_total_credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.company_id = p_company_id
    AND je.status = 'posted'
    AND je.date <= p_as_of_date;

  RETURN CASE WHEN v_normal_balance = 'debit'
    THEN v_total_debit - v_total_credit
    ELSE v_total_credit - v_total_debit
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 17. VIEWS ────────────────────────────────────────────────

-- Aged Receivables View
CREATE OR REPLACE VIEW v_aged_receivables AS
SELECT
  a.id AS account_id,
  a.company_id,
  a.code,
  a.name_ar AS account_name,
  je.date AS invoice_date,
  je.id AS journal_entry_id,
  je.entry_number,
  je.reference,
  jel.debit AS amount,
  CURRENT_DATE - je.date AS days_overdue,
  CASE
    WHEN CURRENT_DATE - je.date <= 30 THEN '0-30'
    WHEN CURRENT_DATE - je.date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - je.date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.is_receivable = true
  AND je.status = 'posted'
  AND jel.debit > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_lines jel2
    JOIN journal_entries je2 ON je2.id = jel2.journal_entry_id
    WHERE jel2.account_id = a.id
      AND je2.status = 'posted'
      AND je2.date > je.date
      AND jel2.credit >= jel.debit - jel2.credit
  );

-- Aged Payables View
CREATE OR REPLACE VIEW v_aged_payables AS
SELECT
  a.id AS account_id,
  a.company_id,
  a.code,
  a.name_ar AS account_name,
  je.date AS invoice_date,
  je.id AS journal_entry_id,
  je.entry_number,
  je.reference,
  jel.credit AS amount,
  CURRENT_DATE - je.date AS days_overdue,
  CASE
    WHEN CURRENT_DATE - je.date <= 30 THEN '0-30'
    WHEN CURRENT_DATE - je.date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - je.date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.is_payable = true
  AND je.status = 'posted'
  AND jel.credit > 0;

-- ── 18. PERIOD LOCKING SAFEGUARD ────────────────────────────
CREATE OR REPLACE FUNCTION prevent_posting_to_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status TEXT;
BEGIN
  IF NEW.period_id IS NOT NULL THEN
    SELECT status INTO v_period_status
    FROM accounting_periods
    WHERE id = NEW.period_id;
    IF v_period_status = 'closed' THEN
      RAISE EXCEPTION 'لا يمكن الترحيل إلى فترة مغلقة';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_posting_closed_period ON journal_entries;
CREATE TRIGGER prevent_posting_closed_period
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_posting_to_closed_period();
