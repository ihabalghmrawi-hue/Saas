-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Wallet, Inventory Movements, Accounting, Staff Permissions
-- Date: 2026-05-08
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Warehouses: add missing columns ────────────────────────────────────────
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS address    TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── 2. Wallets table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  name_ar         TEXT,
  type            TEXT        NOT NULL DEFAULT 'cash' CHECK (type IN ('cash','bank','digital')),
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  initial_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_default      BOOLEAN     NOT NULL DEFAULT false,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  bank_name       TEXT,
  account_number  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_company ON wallets(company_id);
CREATE INDEX IF NOT EXISTS idx_wallets_default ON wallets(company_id, is_default) WHERE is_default = true;

-- ── 3. Transactions table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wallet_id        UUID        REFERENCES wallets(id) ON DELETE SET NULL,
  type             TEXT        NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount           NUMERIC(15,2) NOT NULL,
  description      TEXT,
  description_ar   TEXT,
  reference_id     UUID,
  reference_type   TEXT,
  payment_method   TEXT        DEFAULT 'cash',
  transaction_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT        NOT NULL DEFAULT 'completed',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_company   ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet    ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON transactions(company_id, transaction_date DESC);

-- ── 4. Inventory movements table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id      UUID        NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  warehouse_id    UUID        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN (
                    'purchase','sale','return_sale','return_purchase',
                    'adjustment','transfer_in','transfer_out','opening'
                  )),
  quantity        NUMERIC(15,3) NOT NULL,
  quantity_before NUMERIC(15,3) NOT NULL DEFAULT 0,
  quantity_after  NUMERIC(15,3) NOT NULL DEFAULT 0,
  reference_id    UUID,
  reference_type  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_company   ON inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_product   ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_warehouse ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_date      ON inventory_movements(created_at DESC);

-- ── 5. Inventory table (current stock per product/warehouse) ──────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id)   ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products(id)    ON DELETE CASCADE,
  warehouse_id UUID        NOT NULL REFERENCES warehouses(id)  ON DELETE CASCADE,
  quantity     NUMERIC(15,3) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_company   ON inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product   ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);

-- ── 6. Accounting: chart of accounts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code       TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  name_ar    TEXT,
  type       TEXT    NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

-- ── 7. Journal entries ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  reference   TEXT,
  source      TEXT,
  source_id   UUID,
  is_posted   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_date    ON journal_entries(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_source  ON journal_entries(source, source_id);

-- ── 8. Journal entry lines ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID           NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID           NOT NULL REFERENCES accounts(id),
  debit            NUMERIC(15,2)  NOT NULL DEFAULT 0,
  credit           NUMERIC(15,2)  NOT NULL DEFAULT 0,
  description      TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jel_entry   ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

-- ── 9. Staff roles and permissions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_roles (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  name_ar     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID    NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
  permission_code TEXT    NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS staff_users (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id     UUID    REFERENCES staff_roles(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  pin_hash    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_company ON staff_users(company_id);
CREATE INDEX IF NOT EXISTS idx_role_perms    ON role_permissions(role_id);

-- ── 10. Expense categories ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  name_ar    TEXT,
  icon       TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 11. Product categories & units ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  name_ar    TEXT,
  icon       TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  name_ar    TEXT,
  symbol     TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS Policies (enable and add select/insert/update/delete for own company) ─
ALTER TABLE wallets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically (admin client), so no policies
-- needed for server-side admin operations. Add user-level policies if needed.
