-- ============================================================
-- ACCOUNTING SCHEMA ENHANCEMENTS
-- Run in Supabase SQL Editor after base schema
-- Safe to re-run (idempotent)
-- ============================================================

-- ── journal_entries: add missing columns ─────────────────────────────────────
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS source    TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_journal_source ON journal_entries(company_id, source, source_id);

-- ── journal_entry_lines ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES accounts(id),
  debit            NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  description      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jel_entry   ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_jel" ON journal_entry_lines;
CREATE POLICY "allow_all_jel" ON journal_entry_lines FOR ALL USING (true) WITH CHECK (true);

-- ── accounts: add missing columns + unique constraint ────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_company_code_unique'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_company_code_unique UNIQUE (company_id, code);
  END IF;
END $$;

-- ── wallets ───────────────────────────────────────────────────────────────────
-- Add missing columns if table already exists from older schema
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS balance     NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS currency    TEXT DEFAULT 'SAR';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_default  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT 'الصندوق الرئيسي',
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency    TEXT DEFAULT 'SAR',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_company ON wallets(company_id);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_wallets" ON wallets;
CREATE POLICY "allow_all_wallets" ON wallets FOR ALL USING (true) WITH CHECK (true);

-- ── transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       TEXT NOT NULL,
  wallet_id        UUID REFERENCES wallets(id),
  type             TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount           NUMERIC(15,2) NOT NULL,
  description      TEXT,
  reference_id     TEXT,
  reference_type   TEXT,
  payment_method   TEXT DEFAULT 'cash',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet  ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(company_id, transaction_date DESC);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_transactions" ON transactions;
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- ── Auto-provision: wallet + chart of accounts for existing company ───────────
DO $$
DECLARE
  v_company_id UUID;
  v_company_id_text TEXT;
BEGIN
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  v_company_id_text := v_company_id::TEXT;
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'لا توجد شركة — أنشئ حساباً أولاً';
    RETURN;
  END IF;

  -- Default wallet
  INSERT INTO wallets (company_id, name, balance, is_default, is_active)
  VALUES (v_company_id, 'الصندوق الرئيسي', 0, true, true)
  ON CONFLICT DO NOTHING;

  -- Chart of accounts
  INSERT INTO accounts (company_id, code, name, name_ar, type, is_active)
  VALUES
    (v_company_id, '1001', 'Cash',                'الصندوق',               'asset',     true),
    (v_company_id, '1002', 'Bank',                'البنك',                 'asset',     true),
    (v_company_id, '1100', 'Accounts Receivable', 'ذمم مدينة',             'asset',     true),
    (v_company_id, '1200', 'Inventory',           'المخزون',               'asset',     true),
    (v_company_id, '2001', 'Accounts Payable',    'ذمم دائنة',             'liability', true),
    (v_company_id, '4001', 'Sales Revenue',       'إيرادات المبيعات',      'revenue',   true),
    (v_company_id, '5001', 'Cost of Goods Sold',  'تكلفة البضاعة المباعة', 'expense',   true),
    (v_company_id, '5100', 'Operating Expenses',  'المصروفات التشغيلية',   'expense',   true)
  ON CONFLICT (company_id, code) DO NOTHING;

  RAISE NOTICE 'تم إعداد دليل الحسابات والصندوق للشركة: %', v_company_id;
END $$;
