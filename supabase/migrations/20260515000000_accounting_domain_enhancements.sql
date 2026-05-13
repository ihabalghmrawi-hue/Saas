-- ============================================================
-- Accounting Domain — Daily Balances, Snapshots, Constraints
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ── 1. ACCOUNT BALANCES DAILY ──────────────────────────────
-- Materialized daily snapshot of every account balance
CREATE TABLE IF NOT EXISTS account_balances_daily (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  account_id        UUID NOT NULL REFERENCES accounts(id),
  as_of_date        DATE NOT NULL,
  opening_debit     DECIMAL(18,2) DEFAULT 0,
  opening_credit    DECIMAL(18,2) DEFAULT 0,
  period_debit      DECIMAL(18,2) DEFAULT 0,
  period_credit     DECIMAL(18,2) DEFAULT 0,
  closing_debit     DECIMAL(18,2) DEFAULT 0,
  closing_credit    DECIMAL(18,2) DEFAULT 0,
  net_movement      DECIMAL(18,2) GENERATED ALWAYS AS (period_debit - period_credit) STORED,
  balance           DECIMAL(18,2) DEFAULT 0,
  currency          TEXT DEFAULT 'SAR',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, account_id, as_of_date)
);

-- ── 2. FINANCIAL SNAPSHOTS ─────────────────────────────────
-- Point-in-time financial state for reporting
CREATE TABLE IF NOT EXISTS financial_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  snapshot_type     TEXT NOT NULL CHECK (snapshot_type IN ('daily','monthly','quarterly','yearly','custom')),
  as_of_date        DATE NOT NULL,
  period_id         UUID REFERENCES accounting_periods(id),
  fiscal_year_id    UUID REFERENCES fiscal_years(id),
  data              JSONB NOT NULL DEFAULT '{}',
  summary           JSONB,
  total_assets      DECIMAL(18,2) DEFAULT 0,
  total_liabilities DECIMAL(18,2) DEFAULT 0,
  total_equity      DECIMAL(18,2) DEFAULT 0,
  net_income        DECIMAL(18,2) DEFAULT 0,
  total_revenue     DECIMAL(18,2) DEFAULT 0,
  total_expenses    DECIMAL(18,2) DEFAULT 0,
  cash_flow         JSONB,
  metadata          JSONB,
  is_final          BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, snapshot_type, as_of_date)
);

-- ── 3. FINANCIAL INTEGRITY LOGS ───────────────────────────
CREATE TABLE IF NOT EXISTS financial_integrity_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  check_type        TEXT NOT NULL,
  severity          TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  status            TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  description       TEXT NOT NULL,
  details           JSONB,
  affected_entries  UUID[],
  affected_accounts UUID[],
  detected_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID,
  resolution_notes  TEXT
);

-- ── 4. ENHANCED ACCOUNT CONSTRAINTS ───────────────────────
-- Ensure accounts table has proper constraints
DO $$
BEGIN
  -- Code must be unique per company
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_accounts_company_code'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT uq_accounts_company_code UNIQUE (company_id, code);
  END IF;

  -- Prevent self-referencing parent
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_accounts_no_self_parent'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT ck_accounts_no_self_parent CHECK (id IS DISTINCT FROM parent_id);
  END IF;

  -- Level must be 1-4
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_accounts_level_range'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT ck_accounts_level_range CHECK (level BETWEEN 1 AND 4);
  END IF;

  -- Non-negative balances
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_accounts_non_negative_balance'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT ck_accounts_non_negative_balance CHECK (current_balance >= 0 OR normal_balance = 'credit');
  END IF;
END $$;

-- ── 5. JOURNAL ENTRY ENHANCED CONSTRAINTS ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_journal_entries_date_range'
  ) THEN
    ALTER TABLE journal_entries ADD CONSTRAINT ck_journal_entries_date_range CHECK (date IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_journal_entries_total_non_negative'
  ) THEN
    ALTER TABLE journal_entries ADD CONSTRAINT ck_journal_entries_total_non_negative CHECK (total_debit >= 0 AND total_credit >= 0);
  END IF;
END $$;

-- ── 6. JOURNAL LINE CONSTRAINTS ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_journal_lines_non_negative'
  ) THEN
    ALTER TABLE journal_entry_lines ADD CONSTRAINT ck_journal_lines_non_negative CHECK (debit >= 0 AND credit >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_journal_lines_xor_balance'
  ) THEN
    ALTER TABLE journal_entry_lines ADD CONSTRAINT ck_journal_lines_xor_balance CHECK (
      (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
    );
  END IF;
END $$;

-- ── 7. POSTING RULE CONSTRAINTS ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_posting_rules_priority_range'
  ) THEN
    ALTER TABLE posting_rules ADD CONSTRAINT ck_posting_rules_priority_range CHECK (priority >= 0);
  END IF;
END $$;

-- ── 8. IMMUTABLE POSTED ENTRIES TRIGGER ───────────────────
CREATE OR REPLACE FUNCTION prevent_modification_of_posted_entries()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'posted' AND NEW.status = 'posted' THEN
    -- Allow status changes (reversal) but prevent data field changes
    IF OLD.date IS DISTINCT FROM NEW.date
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.total_debit IS DISTINCT FROM NEW.total_debit
      OR OLD.total_credit IS DISTINCT FROM NEW.total_credit
      OR OLD.company_id IS DISTINCT FROM NEW.company_id
    THEN
      RAISE EXCEPTION 'لا يمكن تعديل قيد مرحّل. استخدم قيد عكسي بدلاً من ذلك.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS immutable_posted_entries ON journal_entries;
CREATE TRIGGER immutable_posted_entries
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_modification_of_posted_entries();

-- ── 9. PREVENT DELETION OF POSTED ENTRIES ─────────────────
CREATE OR REPLACE FUNCTION prevent_deletion_of_posted_entries()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'لا يمكن حذف قيد مرحّل أو معكوس.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_deletion_posted ON journal_entries;
CREATE TRIGGER prevent_deletion_posted
  BEFORE DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_deletion_of_posted_entries();

-- ── 10. PREVENT DUPLICATE ACCOUNT CODES ───────────────────
CREATE OR REPLACE FUNCTION prevent_duplicate_account_code()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounts
    WHERE company_id = NEW.company_id
      AND code = NEW.code
      AND id IS DISTINCT FROM NEW.id
      AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'رمز الحساب % مستخدم بالفعل في هذه الشركة', NEW.code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_duplicate_account_code ON accounts;
CREATE TRIGGER check_duplicate_account_code
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_account_code();

-- ── 11. UPDATE ACCOUNT HIERARCHY ON PARENT CHANGE ─────────
CREATE OR REPLACE FUNCTION update_account_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id != OLD.parent_id THEN
    -- Prevent circular references
    IF EXISTS (
      WITH RECURSIVE tree AS (
        SELECT id, parent_id FROM accounts WHERE id = NEW.parent_id
        UNION ALL
        SELECT a.id, a.parent_id FROM accounts a JOIN tree t ON a.id = t.parent_id
      )
      SELECT 1 FROM tree WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'لا يمكن إنشاء مرجع دائري في شجرة الحسابات';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_circular_account_parent ON accounts;
CREATE TRIGGER check_circular_account_parent
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_account_hierarchy();

-- ── 12. AUTO-GENERATED AUDIT FOR POSTING ──────────────────
CREATE OR REPLACE FUNCTION auto_audit_journal_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO journal_audit_trail (
      journal_entry_id, company_id, action, old_values,
      new_values, performed_at
    ) VALUES (
      NEW.id, NEW.company_id,
      CASE
        WHEN NEW.status = 'posted' THEN 'posted'
        WHEN NEW.status = 'reversed' THEN 'reversed'
        WHEN NEW.status = 'void' THEN 'voided'
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'modified'
      END,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_audit_journal_trigger ON journal_entries;
CREATE TRIGGER auto_audit_journal_trigger
  AFTER UPDATE ON journal_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_audit_journal_action();

-- ── 13. INDEXES FOR NEW TABLES ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_account_balances_daily_company
  ON account_balances_daily(company_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_balances_daily_account
  ON account_balances_daily(company_id, account_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_company
  ON financial_snapshots(company_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_type
  ON financial_snapshots(company_id, snapshot_type, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_integrity_logs_company
  ON financial_integrity_logs(company_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_integrity_logs_status
  ON financial_integrity_logs(company_id, status);

-- ── 14. RLS FOR NEW TABLES ────────────────────────────────
ALTER TABLE account_balances_daily    ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_integrity_logs  ENABLE ROW LEVEL SECURITY;

-- ── 15. RLS POLICIES ──────────────────────────────────────
DO $$
DECLARE
  tables_with_company TEXT[] := ARRAY[
    'account_balances_daily', 'financial_snapshots', 'financial_integrity_logs'
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
