-- ============================================================
-- Accounting Engine Migration
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ── 1. ALTER accounts table ──────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS level         INT     DEFAULT 3;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_postable   BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_group TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_header     BOOLEAN DEFAULT false;

-- ── 2. ALTER journal_entries table ───────────────────────────
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fiscal_year_id    UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS period_id         UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS auto_generated    BOOLEAN  DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_document   TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS batch_id          UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_by       TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_at         TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_of       UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_entry_id UUID;

-- ── 3. CREATE fiscal_years ────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_years (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name       TEXT,
  start_date DATE,
  end_date   DATE,
  status     TEXT DEFAULT 'active' CHECK (status IN ('open', 'closed', 'draft', 'active')),
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. CREATE accounting_periods ─────────────────────────────
CREATE TABLE IF NOT EXISTS accounting_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  fiscal_year_id  UUID NOT NULL,
  period_number   INT,
  name            TEXT,
  start_date      DATE,
  end_date        DATE,
  status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. CREATE account_balances ────────────────────────────────
CREATE TABLE IF NOT EXISTS account_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  period_id       UUID NOT NULL,
  company_id      UUID NOT NULL,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  period_debit    NUMERIC(15,2) DEFAULT 0,
  period_credit   NUMERIC(15,2) DEFAULT 0,
  closing_balance NUMERIC(15,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, period_id)
);

-- ── 6. CREATE cost_centers ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_centers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  code       TEXT,
  name       TEXT,
  name_ar    TEXT,
  parent_id  UUID,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Enable RLS ─────────────────────────────────────────────
ALTER TABLE fiscal_years     ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers     ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS policies (permissive, same as existing tables) ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fiscal_years' AND policyname = 'fiscal_years_all'
  ) THEN
    CREATE POLICY fiscal_years_all ON fiscal_years FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounting_periods' AND policyname = 'accounting_periods_all'
  ) THEN
    CREATE POLICY accounting_periods_all ON accounting_periods FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_balances' AND policyname = 'account_balances_all'
  ) THEN
    CREATE POLICY account_balances_all ON account_balances FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'cost_centers_all'
  ) THEN
    CREATE POLICY cost_centers_all ON cost_centers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 9. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fiscal_years_company        ON fiscal_years     (company_id);
CREATE INDEX IF NOT EXISTS idx_periods_fiscal_year         ON accounting_periods (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_periods_company             ON accounting_periods (company_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_account    ON account_balances  (account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_period     ON account_balances  (period_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_company    ON account_balances  (company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal_year ON journal_entries   (fiscal_year_id) WHERE fiscal_year_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_period      ON journal_entries   (period_id)      WHERE period_id IS NOT NULL;

-- ── 10. Function: get_account_net_balance ─────────────────────
CREATE OR REPLACE FUNCTION get_account_net_balance(
  p_account_id  UUID,
  p_company_id  UUID,
  p_date_from   DATE DEFAULT NULL,
  p_date_to     DATE DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  v_normal_balance TEXT;
  v_total_debit    NUMERIC := 0;
  v_total_credit   NUMERIC := 0;
BEGIN
  SELECT normal_balance INTO v_normal_balance
  FROM accounts
  WHERE id = p_account_id AND company_id = p_company_id;

  IF v_normal_balance IS NULL THEN
    RETURN 0;
  END IF;

  SELECT
    COALESCE(SUM(jel.debit),  0),
    COALESCE(SUM(jel.credit), 0)
  INTO v_total_debit, v_total_credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.company_id  = p_company_id
    AND je.status      = 'posted'
    AND (p_date_from IS NULL OR je.date >= p_date_from)
    AND (p_date_to   IS NULL OR je.date <= p_date_to);

  IF v_normal_balance = 'debit' THEN
    RETURN v_total_debit - v_total_credit;
  ELSE
    RETURN v_total_credit - v_total_debit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── 11. View: v_trial_balance ─────────────────────────────────
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
  a.id,
  a.company_id,
  a.code,
  a.name_ar,
  a.name,
  a.type,
  a.normal_balance,
  COALESCE(SUM(jel.debit),  0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  CASE
    WHEN a.normal_balance = 'debit'
    THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
    ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit),  0)
  END AS balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je
  ON je.id = jel.journal_entry_id
  AND je.status = 'posted'
WHERE a.is_active   = true
  AND a.is_postable = true
GROUP BY
  a.id, a.company_id, a.code, a.name_ar, a.name, a.type, a.normal_balance;
