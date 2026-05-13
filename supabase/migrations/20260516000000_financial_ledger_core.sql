-- ============================================================
-- Financial Ledger Core — Immutable Accounting Infrastructure
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ── 1. EXTEND journal_entries ──────────────────────────────
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'manual';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_id       TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_posted       BOOLEAN DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_at       TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_of_id  UUID REFERENCES journal_entries(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS correction_of_id UUID REFERENCES journal_entries(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_id       UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS cost_center_id  UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS currency        TEXT DEFAULT 'SAR';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS exchange_rate   DECIMAL(10,6) DEFAULT 1;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_type  TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_by_id  UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_by_id   UUID;

-- ── 2. EXTEND journal_entry_lines ──────────────────────────
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS branch_id        UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS cost_center_id   UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS currency         TEXT DEFAULT 'SAR';
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS exchange_rate    DECIMAL(10,6) DEFAULT 1;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS reference_id     TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS reference_type   TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tax_code         TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tax_amount       DECIMAL(15,2) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS party_id         UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS project_id       UUID;

-- ── 3. UNIQUE ENTRY NUMBER PER COMPANY ─────────────────────
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS uq_journal_entries_company_entry_number;
ALTER TABLE journal_entries ADD CONSTRAINT uq_journal_entries_company_entry_number UNIQUE (company_id, entry_number);

-- ── 4. IMMUTABLE POSTED ENTRIES TRIGGER ────────────────────
CREATE OR REPLACE FUNCTION ledger_prevent_posted_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'posted' AND TG_OP = 'UPDATE' THEN
    IF OLD.date IS DISTINCT FROM NEW.date
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.total_debit IS DISTINCT FROM NEW.total_debit
      OR OLD.total_credit IS DISTINCT FROM NEW.total_credit
    THEN
      RAISE EXCEPTION 'لا يمكن تعديل قيد مرحّل. استخدم قيد عكسي.';
    END IF;
  END IF;

  IF OLD.status IN ('posted', 'reversed') AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'لا يمكن حذف قيد مرحّل أو معكوس.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_immutable_posted ON journal_entries;
CREATE TRIGGER ledger_immutable_posted
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_prevent_posted_modification();

-- ── 5. PREVENT LINE MODIFICATION ON POSTED ENTRIES ─────────
CREATE OR REPLACE FUNCTION ledger_prevent_line_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM journal_entries WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF v_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'لا يمكن تعديل بنود قيد مرحّل أو معكوس.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_immutable_lines ON journal_entry_lines;
CREATE TRIGGER ledger_immutable_lines
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION ledger_prevent_line_modification();

-- ── 6. BALANCE VALIDATION TRIGGER ──────────────────────────
CREATE OR REPLACE FUNCTION ledger_validate_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_diff NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT ABS(COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0))
    INTO v_diff
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF v_diff > 0.01 THEN
      RAISE EXCEPTION 'القيد غير متوازن: الفرق %', v_diff;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_balance_check ON journal_entry_lines;
CREATE TRIGGER ledger_balance_check
  AFTER INSERT OR UPDATE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION ledger_validate_balance();

-- ── 7. PREVENT DUPLICATE POSTING (idempotency) ────────────
CREATE OR REPLACE FUNCTION ledger_prevent_duplicate_posting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source_id IS NOT NULL AND NEW.source NOT IN ('manual', 'reversal') THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE company_id = NEW.company_id
        AND source = NEW.source
        AND source_id = NEW.source_id
        AND id IS DISTINCT FROM NEW.id
        AND status = 'posted'
    ) THEN
      RAISE EXCEPTION 'تم ترحيل هذه المعاملة مسبقاً (المصدر: %, المعرف: %)', NEW.source, NEW.source_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_idempotent_posting ON journal_entries;
CREATE TRIGGER ledger_idempotent_posting
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_prevent_duplicate_posting();

-- ── 8. RLS POLICIES (company-scoped via memberships) ───────
DO $$
DECLARE
  accounting_tables TEXT[] := ARRAY[
    'fiscal_years', 'accounting_periods', 'account_balances',
    'account_balances_daily', 'financial_snapshots', 'financial_integrity_logs',
    'posting_rules', 'posting_rule_lines', 'account_mappings',
    'reconciliations', 'reconciliation_lines',
    'recurring_journals', 'recurring_journal_log',
    'branches', 'cost_centers', 'cost_center_allocation_rules',
    'approval_workflows', 'journal_approvals', 'journal_audit_trail',
    'integrity_checks', 'ai_insights'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY accounting_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_select" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_insert" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_update" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_delete" ON %s', t, t);

    EXECUTE format(
      'CREATE POLICY "%1$s_tenant_select" ON %1$s FOR SELECT TO authenticated USING (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_tenant_insert" ON %1$s FOR INSERT TO authenticated WITH CHECK (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_tenant_update" ON %1$s FOR UPDATE TO authenticated USING (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      ) WITH CHECK (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_tenant_delete" ON %1$s FOR DELETE TO authenticated USING (
        company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
      )', t
    );
  END LOOP;
END $$;

-- Redo RLS for core tables (journal_entries, accounts) if policies are permissive
DROP POLICY IF EXISTS "Users can update journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries" ON journal_entries;
CREATE POLICY "journal_entries_tenant_update" ON journal_entries FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "journal_entries_tenant_delete" ON journal_entries FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));

-- ── 9. LEDGER BALANCE FUNCTIONS ────────────────────────────
-- Core function: derive balance from journal lines (never mutate)
CREATE OR REPLACE FUNCTION ledger_get_account_balance(
  p_account_id  UUID,
  p_company_id  UUID,
  p_as_of_date  DATE DEFAULT NULL
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
    AND (p_as_of_date IS NULL OR je.date <= p_as_of_date);

  RETURN CASE
    WHEN v_normal_balance = 'debit' THEN v_total_debit - v_total_credit
    ELSE v_total_credit - v_total_debit
  END;
END;
$$ LANGUAGE plpgsql;

-- Batch balances for all accounts in a company
CREATE OR REPLACE FUNCTION ledger_get_all_balances(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT NULL
) RETURNS TABLE (
  account_id    UUID,
  account_code  TEXT,
  account_name  TEXT,
  account_type  TEXT,
  normal_balance TEXT,
  balance       NUMERIC,
  total_debit   NUMERIC,
  total_credit  NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.code,
    a.name_ar,
    a.type,
    a.normal_balance,
    COALESCE(
      CASE WHEN a.normal_balance = 'debit'
        THEN SUM(jel.debit) - SUM(jel.credit)
        ELSE SUM(jel.credit) - SUM(jel.debit)
      END, 0
    ) AS balance,
    COALESCE(SUM(jel.debit), 0) AS total_debit,
    COALESCE(SUM(jel.credit), 0) AS total_credit
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je
    ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND (p_as_of_date IS NULL OR je.date <= p_as_of_date)
  WHERE a.company_id = p_company_id AND a.is_active = true
  GROUP BY a.id, a.code, a.name_ar, a.type, a.normal_balance
  ORDER BY a.code;
END;
$$ LANGUAGE plpgsql;

-- ── 10. PERIOD BALANCE FUNCTIONS ──────────────────────────
CREATE OR REPLACE FUNCTION ledger_get_period_balances(
  p_company_id UUID,
  p_period_id  UUID
) RETURNS TABLE (
  account_id     UUID,
  account_code   TEXT,
  opening_balance NUMERIC,
  period_debit   NUMERIC,
  period_credit  NUMERIC,
  closing_balance NUMERIC
) AS $$
DECLARE
  v_period_start DATE;
  v_period_end   DATE;
  v_fiscal_year_start DATE;
BEGIN
  SELECT ap.start_date, ap.end_date, fy.start_date
  INTO v_period_start, v_period_end, v_fiscal_year_start
  FROM accounting_periods ap
  JOIN fiscal_years fy ON fy.id = ap.fiscal_year_id
  WHERE ap.id = p_period_id AND ap.company_id = p_company_id;

  RETURN QUERY
  SELECT
    a.id,
    a.code,
    ledger_get_account_balance(a.id, p_company_id, v_fiscal_year_start - 1) AS opening_balance,
    COALESCE(SUM(jel.debit) FILTER (WHERE je.date BETWEEN v_period_start AND v_period_end), 0) AS period_debit,
    COALESCE(SUM(jel.credit) FILTER (WHERE je.date BETWEEN v_period_start AND v_period_end), 0) AS period_credit,
    ledger_get_account_balance(a.id, p_company_id, v_period_end) AS closing_balance
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  WHERE a.company_id = p_company_id AND a.is_active = true
  GROUP BY a.id, a.code
  ORDER BY a.code;
END;
$$ LANGUAGE plpgsql;

-- ── 11. TRIAL BALANCE VIEW (parameterized) ────────────────
DROP VIEW IF EXISTS v_trial_balance;
CREATE OR REPLACE FUNCTION ledger_get_trial_balance(
  p_company_id UUID,
  p_from_date  DATE DEFAULT NULL,
  p_to_date    DATE DEFAULT NULL
) RETURNS TABLE (
  account_id      UUID,
  account_code    TEXT,
  account_name    TEXT,
  account_name_ar TEXT,
  account_type    TEXT,
  normal_balance  TEXT,
  opening_debit   NUMERIC,
  opening_credit  NUMERIC,
  period_debit    NUMERIC,
  period_credit   NUMERIC,
  closing_debit   NUMERIC,
  closing_credit  NUMERIC,
  balance         NUMERIC
) AS $$
DECLARE
  v_fy_start DATE;
BEGIN
  SELECT MIN(start_date) INTO v_fy_start
  FROM fiscal_years WHERE company_id = p_company_id AND is_current = true;

  RETURN QUERY
  SELECT
    a.id,
    a.code,
    a.name,
    a.name_ar,
    a.type,
    a.normal_balance,
    CASE WHEN a.normal_balance = 'debit'
      THEN ledger_get_account_balance(a.id, p_company_id, COALESCE(p_from_date, v_fy_start) - 1)
      ELSE 0
    END AS opening_debit,
    CASE WHEN a.normal_balance = 'credit'
      THEN ledger_get_account_balance(a.id, p_company_id, COALESCE(p_from_date, v_fy_start) - 1)
      ELSE 0
    END AS opening_credit,
    COALESCE(SUM(jel.debit)  FILTER (WHERE je.date BETWEEN COALESCE(p_from_date, '1900-01-01') AND COALESCE(p_to_date, '9999-12-31')), 0) AS period_debit,
    COALESCE(SUM(jel.credit) FILTER (WHERE je.date BETWEEN COALESCE(p_from_date, '1900-01-01') AND COALESCE(p_to_date, '9999-12-31')), 0) AS period_credit,
    CASE WHEN ledger_get_account_balance(a.id, p_company_id, p_to_date) > 0
      THEN ledger_get_account_balance(a.id, p_company_id, p_to_date)
      ELSE 0
    END AS closing_debit,
    CASE WHEN ledger_get_account_balance(a.id, p_company_id, p_to_date) < 0
      THEN ABS(ledger_get_account_balance(a.id, p_company_id, p_to_date))
      ELSE 0
    END AS closing_credit,
    ledger_get_account_balance(a.id, p_company_id, p_to_date) AS balance
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je
    ON je.id = jel.journal_entry_id AND je.status = 'posted'
  WHERE a.company_id = p_company_id AND a.is_active = true AND a.is_postable = true
  GROUP BY a.id, a.code, a.name, a.name_ar, a.type, a.normal_balance
  ORDER BY a.code;
END;
$$ LANGUAGE plpgsql;

-- ── 12. GENERAL LEDGER VIEW ───────────────────────────────
CREATE OR REPLACE FUNCTION ledger_get_general_ledger(
  p_company_id     UUID,
  p_account_id     UUID DEFAULT NULL,
  p_from_date      DATE DEFAULT NULL,
  p_to_date        DATE DEFAULT NULL,
  p_cost_center_id UUID DEFAULT NULL,
  p_branch_id      UUID DEFAULT NULL
) RETURNS TABLE (
  entry_id       UUID,
  entry_number   TEXT,
  entry_date     DATE,
  description    TEXT,
  reference      TEXT,
  source         TEXT,
  source_id      TEXT,
  account_id     UUID,
  account_code   TEXT,
  account_name   TEXT,
  debit          NUMERIC,
  credit         NUMERIC,
  running_balance NUMERIC,
  cost_center_id UUID,
  branch_id      UUID,
  created_at     TIMESTAMPTZ
) AS $$
DECLARE
  v_opening_balance NUMERIC := 0;
BEGIN
  IF p_account_id IS NOT NULL THEN
    v_opening_balance := ledger_get_account_balance(p_account_id, p_company_id, COALESCE(p_from_date, '1900-01-01') - 1);
  END IF;

  RETURN QUERY
  SELECT
    je.id,
    je.entry_number,
    je.date,
    je.description,
    je.reference,
    je.source,
    je.source_id,
    jel.account_id,
    a.code,
    a.name_ar,
    jel.debit,
    jel.credit,
    SUM(jel.debit - jel.credit) OVER (
      PARTITION BY jel.account_id
      ORDER BY je.date, je.entry_number, jel.line_number
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) + CASE WHEN jel.account_id = p_account_id THEN v_opening_balance ELSE 0 END AS running_balance,
    jel.cost_center_id,
    jel.branch_id,
    je.created_at
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  JOIN accounts a ON a.id = jel.account_id AND a.company_id = p_company_id
  WHERE je.company_id = p_company_id
    AND (p_account_id IS NULL OR jel.account_id = p_account_id)
    AND (p_from_date IS NULL OR je.date >= p_from_date)
    AND (p_to_date IS NULL OR je.date <= p_to_date)
    AND (p_cost_center_id IS NULL OR jel.cost_center_id = p_cost_center_id)
    AND (p_branch_id IS NULL OR jel.branch_id = p_branch_id)
  ORDER BY jel.account_id, je.date, je.entry_number, jel.line_number;
END;
$$ LANGUAGE plpgsql;

-- ── 13. DAILY BALANCE GENERATION ──────────────────────────
CREATE OR REPLACE FUNCTION ledger_generate_daily_balances(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO account_balances_daily (
    company_id, account_id, as_of_date,
    opening_debit, opening_credit, period_debit, period_credit,
    closing_debit, closing_credit, balance
  )
  SELECT
    p_company_id,
    a.id,
    p_as_of_date,
    CASE WHEN a.normal_balance = 'debit' THEN ledger_get_account_balance(a.id, p_company_id, p_as_of_date - 1) ELSE 0 END,
    CASE WHEN a.normal_balance = 'credit' THEN ledger_get_account_balance(a.id, p_company_id, p_as_of_date - 1) ELSE 0 END,
    COALESCE(SUM(jel.debit)  FILTER (WHERE je.date = p_as_of_date), 0),
    COALESCE(SUM(jel.credit) FILTER (WHERE je.date = p_as_of_date), 0),
    CASE WHEN ledger_get_account_balance(a.id, p_company_id, p_as_of_date) > 0
      THEN ledger_get_account_balance(a.id, p_company_id, p_as_of_date) ELSE 0 END,
    CASE WHEN ledger_get_account_balance(a.id, p_company_id, p_as_of_date) < 0
      THEN ABS(ledger_get_account_balance(a.id, p_company_id, p_as_of_date)) ELSE 0 END,
    ledger_get_account_balance(a.id, p_company_id, p_as_of_date)
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  WHERE a.company_id = p_company_id AND a.is_active = true
  GROUP BY a.id, a.normal_balance, a.code
  ORDER BY a.code
  ON CONFLICT (company_id, account_id, as_of_date) DO UPDATE SET
    opening_debit    = EXCLUDED.opening_debit,
    opening_credit   = EXCLUDED.opening_credit,
    period_debit     = EXCLUDED.period_debit,
    period_credit    = EXCLUDED.period_credit,
    closing_debit    = EXCLUDED.closing_debit,
    closing_credit   = EXCLUDED.closing_credit,
    balance          = EXCLUDED.balance;
END;
$$ LANGUAGE plpgsql;

-- ── 14. FINANCIAL SNAPSHOT ────────────────────────────────
CREATE OR REPLACE FUNCTION ledger_create_snapshot(
  p_company_id      UUID,
  p_snapshot_type   TEXT DEFAULT 'daily',
  p_as_of_date      DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_total_assets     NUMERIC := 0;
  v_total_liabilities NUMERIC := 0;
  v_total_equity     NUMERIC := 0;
  v_total_revenue    NUMERIC := 0;
  v_total_expenses   NUMERIC := 0;
  v_net_income       NUMERIC := 0;
  v_data JSONB;
  v_summary JSONB;
  v_cash_flow JSONB;
  v_period_id UUID;
  v_fiscal_year_id UUID;
BEGIN
  SELECT id INTO v_period_id FROM accounting_periods
  WHERE company_id = p_company_id AND p_as_of_date BETWEEN start_date AND end_date LIMIT 1;

  SELECT id INTO v_fiscal_year_id FROM fiscal_years
  WHERE company_id = p_company_id AND p_as_of_date BETWEEN start_date AND end_date LIMIT 1;

  SELECT
    COALESCE(SUM(balance) FILTER (WHERE a.type = 'asset'), 0),
    COALESCE(SUM(balance) FILTER (WHERE a.type = 'liability'), 0),
    COALESCE(SUM(balance) FILTER (WHERE a.type = 'equity'), 0),
    COALESCE(SUM(balance) FILTER (WHERE a.type = 'revenue'), 0),
    COALESCE(SUM(balance) FILTER (WHERE a.type IN ('expense', 'cogs')), 0)
  INTO v_total_assets, v_total_liabilities, v_total_equity, v_total_revenue, v_total_expenses
  FROM ledger_get_all_balances(p_company_id, p_as_of_date) tb
  JOIN accounts a ON a.id = tb.account_id;

  v_net_income := v_total_revenue - v_total_expenses;
  v_total_equity := v_total_equity + v_net_income;

  SELECT jsonb_build_object(
    'assets', jsonb_build_object('total', v_total_assets),
    'liabilities', jsonb_build_object('total', v_total_liabilities),
    'equity', jsonb_build_object('total', v_total_equity),
    'revenue', jsonb_build_object('total', v_total_revenue),
    'expenses', jsonb_build_object('total', v_total_expenses),
    'net_income', v_net_income
  ) INTO v_summary;

  INSERT INTO financial_snapshots (
    company_id, snapshot_type, as_of_date, period_id, fiscal_year_id,
    data, summary, total_assets, total_liabilities, total_equity,
    net_income, total_revenue, total_expenses
  ) VALUES (
    p_company_id, p_snapshot_type, p_as_of_date, v_period_id, v_fiscal_year_id,
    '{}'::jsonb, v_summary, v_total_assets, v_total_liabilities, v_total_equity,
    v_net_income, v_total_revenue, v_total_expenses
  )
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- ── 15. AGED RECEIVABLES/PAYABLES ─────────────────────────
CREATE OR REPLACE FUNCTION ledger_get_aged_receivables(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  account_id     UUID,
  account_name   TEXT,
  entry_number   TEXT,
  invoice_date   DATE,
  reference      TEXT,
  amount         NUMERIC,
  days_overdue   INT,
  aging_bucket   TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name_ar,
    je.entry_number,
    je.date,
    je.reference,
    jel.debit - jel.credit AS amount,
    (p_as_of_date - je.date)::INT AS days_overdue,
    CASE
      WHEN (p_as_of_date - je.date) <= 30  THEN '0-30'
      WHEN (p_as_of_date - je.date) <= 60  THEN '31-60'
      WHEN (p_as_of_date - je.date) <= 90  THEN '61-90'
      ELSE '90+'
    END AS aging_bucket
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  JOIN accounts a ON a.id = jel.account_id
  WHERE a.company_id = p_company_id
    AND a.is_receivable = true
    AND (jel.debit - jel.credit) > 0
    AND je.date <= p_as_of_date
  ORDER BY je.date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ledger_get_aged_payables(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  account_id     UUID,
  account_name   TEXT,
  entry_number   TEXT,
  invoice_date   DATE,
  reference      TEXT,
  amount         NUMERIC,
  days_overdue   INT,
  aging_bucket   TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name_ar,
    je.entry_number,
    je.date,
    je.reference,
    jel.credit - jel.debit AS amount,
    (p_as_of_date - je.date)::INT AS days_overdue,
    CASE
      WHEN (p_as_of_date - je.date) <= 30  THEN '0-30'
      WHEN (p_as_of_date - je.date) <= 60  THEN '31-60'
      WHEN (p_as_of_date - je.date) <= 90  THEN '61-90'
      ELSE '90+'
    END AS aging_bucket
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  JOIN accounts a ON a.id = jel.account_id
  WHERE a.company_id = p_company_id
    AND a.is_payable = true
    AND (jel.credit - jel.debit) > 0
    AND je.date <= p_as_of_date
  ORDER BY je.date;
END;
$$ LANGUAGE plpgsql;

-- ── 16. AUDIT TRAIL AUTO-LOGGING ──────────────────────────
CREATE OR REPLACE FUNCTION ledger_auto_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO journal_audit_trail (
      journal_entry_id, company_id, action, old_values, new_values, performed_at
    ) VALUES (
      NEW.id, NEW.company_id,
      CASE
        WHEN NEW.status = 'posted'   THEN 'posted'
        WHEN NEW.status = 'reversed' THEN 'reversed'
        WHEN NEW.status = 'void'     THEN 'voided'
        ELSE 'modified'
      END,
      row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_audit_trigger ON journal_entries;
CREATE TRIGGER ledger_audit_trigger
  AFTER UPDATE ON journal_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION ledger_auto_audit();

-- ── 17. INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_date
  ON journal_entry_lines(account_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status_date
  ON journal_entries(company_id, status, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source
  ON journal_entries(company_id, source, source_id) WHERE source IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_comp_acct
  ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type
  ON accounts(company_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable
  ON accounts(company_id, is_receivable) WHERE is_receivable = true;
CREATE INDEX IF NOT EXISTS idx_accounts_payable
  ON accounts(company_id, is_payable) WHERE is_payable = true;
