-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION GUIDE — Run in order in Supabase SQL Editor
-- Safe to run on existing database (uses IF NOT EXISTS + ALTER TABLE IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1: Add missing columns to existing tables ────────────────────────────

-- companies: add missing columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone     TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone  TEXT NOT NULL DEFAULT 'Asia/Riyadh';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- subscriptions: add grace period support
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_ends_at  DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id        UUID REFERENCES plans(id);

-- memberships: add role_id FK (after roles table created)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- company_settings: add new fields
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS theme          TEXT NOT NULL DEFAULT 'light';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tax_enabled    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tax_rate       NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tax_number     TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'INV';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS modules_enabled JSONB NOT NULL DEFAULT '{}';

-- products: add missing columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price      NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(15,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_qty         INT NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes      JSONB NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- sales: link to treasury and shift
ALTER TABLE sales ADD COLUMN IF NOT EXISTS treasury_account_id UUID REFERENCES treasury_accounts(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id            UUID;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS journal_entry_id    UUID REFERENCES journal_entries(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS balance_due         NUMERIC(15,2) NOT NULL DEFAULT 0;

-- purchases: link to treasury
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS treasury_account_id UUID REFERENCES treasury_accounts(id);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS journal_entry_id    UUID REFERENCES journal_entries(id);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS balance_due         NUMERIC(15,2) NOT NULL DEFAULT 0;

-- expenses: link to treasury and journal
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS treasury_account_id UUID REFERENCES treasury_accounts(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS journal_entry_id    UUID REFERENCES journal_entries(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;

-- customers: add credit and balance tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance      NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

-- suppliers: add balance tracking
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance    NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── STEP 2: Create treasury_accounts from existing wallets ─────────────────────
-- Skipped automatically if the wallets table does not exist.

DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets'
  ) THEN
    INSERT INTO treasury_accounts (id, company_id, name, type, currency, balance, is_default, is_active, created_at)
    SELECT
      id,
      company_id,
      name,
      'cash',
      COALESCE(currency, 'SAR'),
      COALESCE(balance, 0),
      COALESCE(is_default, false),
      COALESCE(is_active, true),
      created_at
    FROM wallets
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ── STEP 3: Migrate wallet_transactions to treasury_transactions ──────────────
-- Skipped automatically if the wallet_transactions table does not exist.

DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions'
  ) THEN
    INSERT INTO treasury_transactions (company_id, account_id, type, amount, balance_after, description, reference, source, source_id, created_at)
    SELECT
      wt.company_id,
      wt.wallet_id,
      CASE WHEN wt.type = 'income' THEN 'deposit' ELSE 'withdrawal' END,
      wt.amount,
      0,
      COALESCE(wt.description, ''),
      COALESCE(wt.reference, ''),
      wt.source,
      wt.source_id,
      wt.created_at
    FROM wallet_transactions wt
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ── STEP 4: Seed chart of accounts for companies that don't have one ──────────
-- Run this via the application: call seedDefaultChartOfAccounts() for each company
-- Or manually via the Supabase dashboard for each company.

-- ── STEP 5: Seed default roles for each company ───────────────────────────────
-- Run via application: call seedDefaultRoles() for each company after login.

-- ── STEP 6: Verify data integrity ─────────────────────────────────────────────

-- Check all sales have corresponding journal entries
SELECT s.invoice_number, s.total, s.created_at
FROM sales s
WHERE s.journal_entry_id IS NULL
  AND s.status = 'completed'
ORDER BY s.created_at DESC
LIMIT 100;

-- Check all expenses have treasury impact recorded
SELECT e.reference, e.amount, e.date
FROM expenses e
WHERE e.treasury_account_id IS NULL
ORDER BY e.date DESC
LIMIT 100;

-- Check unbalanced journal entries
SELECT je.reference, je.date,
  SUM(jel.debit) as total_debit, SUM(jel.credit) as total_credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
GROUP BY je.id, je.reference, je.date
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01;
