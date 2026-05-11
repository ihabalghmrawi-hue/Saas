-- ═══════════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT ERP SaaS — Production Schema v2
-- Run in Supabase SQL Editor
-- All tables use IF NOT EXISTS — safe to run on existing databases
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Helpers ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Clean slate: drop all tables in reverse-dependency order ─────────────────
-- Required because prior migrations may have created tables with different column names.
-- CREATE TABLE IF NOT EXISTS would silently skip them, then indexes on new columns fail.
DROP TABLE IF EXISTS audit_logs            CASCADE;
DROP TABLE IF EXISTS notifications         CASCADE;
DROP TABLE IF EXISTS reports_cache         CASCADE;

DROP TABLE IF EXISTS con_files             CASCADE;
DROP TABLE IF EXISTS con_payments          CASCADE;
DROP TABLE IF EXISTS con_materials         CASCADE;
DROP TABLE IF EXISTS con_expenses          CASCADE;
DROP TABLE IF EXISTS con_tasks             CASCADE;
DROP TABLE IF EXISTS con_workers           CASCADE;
DROP TABLE IF EXISTS con_projects          CASCADE;

DROP TABLE IF EXISTS rental_returns        CASCADE;
DROP TABLE IF EXISTS rental_orders         CASCADE;
DROP TABLE IF EXISTS dresses               CASCADE;

DROP TABLE IF EXISTS return_items          CASCADE;
DROP TABLE IF EXISTS returns               CASCADE;
DROP TABLE IF EXISTS shifts                CASCADE;

DROP TABLE IF EXISTS sale_payments         CASCADE;
DROP TABLE IF EXISTS sale_items            CASCADE;
DROP TABLE IF EXISTS sales                 CASCADE;

DROP TABLE IF EXISTS purchase_payments     CASCADE;
DROP TABLE IF EXISTS purchase_items        CASCADE;
DROP TABLE IF EXISTS purchases             CASCADE;

DROP TABLE IF EXISTS expenses              CASCADE;
DROP TABLE IF EXISTS expense_categories    CASCADE;

DROP TABLE IF EXISTS customer_transactions CASCADE;
DROP TABLE IF EXISTS customers             CASCADE;
DROP TABLE IF EXISTS suppliers             CASCADE;

DROP TABLE IF EXISTS inventory_movements   CASCADE;
DROP TABLE IF EXISTS inventory             CASCADE;
DROP TABLE IF EXISTS product_variants      CASCADE;
DROP TABLE IF EXISTS products              CASCADE;
DROP TABLE IF EXISTS warehouses            CASCADE;
DROP TABLE IF EXISTS product_categories    CASCADE;
DROP TABLE IF EXISTS units                 CASCADE;

DROP TABLE IF EXISTS journal_entry_lines   CASCADE;
DROP TABLE IF EXISTS journal_entries       CASCADE;
DROP TABLE IF EXISTS account_mappings      CASCADE;
DROP TABLE IF EXISTS chart_of_accounts     CASCADE;
DROP TABLE IF EXISTS fiscal_periods        CASCADE;
DROP TABLE IF EXISTS accounting_periods    CASCADE;
DROP TABLE IF EXISTS fiscal_years          CASCADE;

DROP TABLE IF EXISTS treasury_transactions CASCADE;
DROP TABLE IF EXISTS treasury_accounts     CASCADE;
DROP TABLE IF EXISTS wallet_transactions   CASCADE;
DROP TABLE IF EXISTS wallets               CASCADE;

DROP TABLE IF EXISTS role_permissions      CASCADE;
DROP TABLE IF EXISTS permissions           CASCADE;
DROP TABLE IF EXISTS roles                 CASCADE;

DROP TABLE IF EXISTS memberships           CASCADE;
DROP TABLE IF EXISTS company_settings      CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS companies             CASCADE;
DROP TABLE IF EXISTS plans                 CASCADE;

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE business_type_enum AS ENUM (
    'pharmacy', 'retail', 'wholesale', 'clothing',
    'stationery', 'tools', 'dress_rental', 'construction', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status_enum AS ENUM (
    'trial', 'active', 'grace', 'expired', 'suspended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan_enum AS ENUM (
    'free', 'starter', 'professional', 'enterprise'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_type_enum AS ENUM (
    'asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_nature_enum AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE period_status_enum AS ENUM ('open', 'closed', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_status_enum AS ENUM ('draft', 'posted', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE treasury_account_type_enum AS ENUM ('cash', 'bank', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE treasury_tx_type_enum AS ENUM (
    'deposit', 'withdrawal', 'transfer_in', 'transfer_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_role_enum AS ENUM (
    'owner', 'admin', 'manager', 'accountant', 'cashier', 'employee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_status_enum AS ENUM (
    'draft', 'confirmed', 'completed', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE purchase_status_enum AS ENUM (
    'draft', 'confirmed', 'received', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_enum AS ENUM (
    'cash', 'bank_transfer', 'card', 'credit', 'mixed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SAAS LAYER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  name_ar      TEXT,
  code         TEXT UNIQUE NOT NULL,           -- 'free' | 'starter' | 'professional' | 'enterprise'
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'USD',
  interval     TEXT NOT NULL DEFAULT 'month',  -- 'month' | 'year'
  trial_days   INT NOT NULL DEFAULT 14,
  max_users    INT,                            -- NULL = unlimited
  max_products INT,
  max_sales    INT,                            -- per month
  features     JSONB NOT NULL DEFAULT '{}',   -- { hasAccounting, hasReports, hasAPI, ... }
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (name, name_ar, code, price, trial_days, max_users, features, sort_order) VALUES
  ('Free',         'مجاني',       'free',         0,    0,  3,  '{"hasAccounting":false,"hasReports":false,"hasExport":false}', 1),
  ('Starter',      'مبتدئ',       'starter',      29,  14,  10, '{"hasAccounting":true,"hasReports":true,"hasExport":false}',  2),
  ('Professional', 'احترافي',     'professional', 79,  14,  50, '{"hasAccounting":true,"hasReports":true,"hasExport":true}',   3),
  ('Enterprise',   'مؤسسي',      'enterprise',   199, 14,  NULL,'{"hasAccounting":true,"hasReports":true,"hasExport":true,"hasAPI":true}', 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  name_ar       TEXT,
  slug          TEXT UNIQUE NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  logo_url      TEXT,
  currency      TEXT NOT NULL DEFAULT 'SAR',
  language      TEXT NOT NULL DEFAULT 'ar',
  timezone      TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id          UUID REFERENCES plans(id),
  plan             TEXT NOT NULL DEFAULT 'free',
  status           TEXT NOT NULL DEFAULT 'trial',
  start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date         DATE,
  trial_ends_at    DATE,
  grace_ends_at    DATE,
  cancelled_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);

CREATE TABLE IF NOT EXISTS company_settings (
  company_id      UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  business_type   TEXT NOT NULL DEFAULT 'retail',
  -- business type is locked after initial setup by design
  theme           TEXT NOT NULL DEFAULT 'light',
  date_format     TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  number_format   TEXT NOT NULL DEFAULT 'arabic',
  tax_enabled     BOOLEAN NOT NULL DEFAULT false,
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_number      TEXT,
  invoice_prefix  TEXT NOT NULL DEFAULT 'INV',
  receipt_prefix  TEXT NOT NULL DEFAULT 'RCP',
  expense_prefix  TEXT NOT NULL DEFAULT 'EXP',
  modules_enabled JSONB NOT NULL DEFAULT '{}',
  custom_fields   JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'employee',
  role_id     UUID,                          -- FK to roles (set after roles table created)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  invited_by  UUID REFERENCES auth.users(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RBAC LAYER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- system roles can't be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource    TEXT NOT NULL,    -- 'sales' | 'purchases' | 'inventory' | ...
  action      TEXT NOT NULL,    -- 'create' | 'read' | 'update' | 'delete' | 'post'
  description TEXT,
  UNIQUE(resource, action)
);

-- Seed core permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('sales',       'create',  'إنشاء فاتورة بيع'),
  ('sales',       'read',    'عرض المبيعات'),
  ('sales',       'update',  'تعديل المبيعات'),
  ('sales',       'delete',  'حذف المبيعات'),
  ('purchases',   'create',  'إنشاء فاتورة شراء'),
  ('purchases',   'read',    'عرض المشتريات'),
  ('purchases',   'update',  'تعديل المشتريات'),
  ('purchases',   'delete',  'حذف المشتريات'),
  ('inventory',   'read',    'عرض المخزون'),
  ('inventory',   'adjust',  'تعديل المخزون'),
  ('expenses',    'create',  'إضافة مصروف'),
  ('expenses',    'read',    'عرض المصروفات'),
  ('expenses',    'delete',  'حذف مصروف'),
  ('accounting',  'read',    'عرض القيود المحاسبية'),
  ('accounting',  'post',    'ترحيل قيود محاسبية'),
  ('treasury',    'read',    'عرض الخزينة'),
  ('treasury',    'transfer','تحويل بين حسابات الخزينة'),
  ('reports',     'view',    'عرض التقارير'),
  ('reports',     'export',  'تصدير التقارير'),
  ('customers',   'create',  'إضافة عميل'),
  ('customers',   'read',    'عرض العملاء'),
  ('customers',   'update',  'تعديل عميل'),
  ('customers',   'delete',  'حذف عميل'),
  ('suppliers',   'create',  'إضافة مورد'),
  ('suppliers',   'read',    'عرض الموردين'),
  ('products',    'create',  'إضافة منتج'),
  ('products',    'read',    'عرض المنتجات'),
  ('products',    'update',  'تعديل منتج'),
  ('products',    'delete',  'حذف منتج'),
  ('users',       'manage',  'إدارة المستخدمين'),
  ('settings',    'manage',  'إدارة الإعدادات'),
  ('construction','read',    'عرض مشاريع البناء'),
  ('construction','write',   'إدارة مشاريع البناء'),
  ('rentals',     'read',    'عرض تأجير الفساتين'),
  ('rentals',     'write',   'إدارة تأجير الفساتين')
ON CONFLICT (resource, action) DO NOTHING;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- FK from memberships to roles (add after roles table exists)
DO $$ BEGIN
  ALTER TABLE memberships ADD CONSTRAINT memberships_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ACCOUNTING LAYER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',   -- open | closed | locked
  closed_at    TIMESTAMPTZ,
  closed_by    UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code           TEXT NOT NULL,
  name           TEXT NOT NULL,
  name_ar        TEXT,
  type           TEXT NOT NULL,    -- asset | liability | equity | revenue | cogs | expense
  nature         TEXT NOT NULL,    -- debit | credit
  parent_id      UUID REFERENCES chart_of_accounts(id),
  is_header      BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  allow_posting  BOOLEAN NOT NULL DEFAULT true,
  description    TEXT,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS account_mappings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,   -- 'sale_cash' | 'sale_credit' | 'expense' | 'purchase_cash' | ...
  debit_account  UUID NOT NULL REFERENCES chart_of_accounts(id),
  credit_account UUID NOT NULL REFERENCES chart_of_accounts(id),
  description    TEXT,
  UNIQUE(company_id, event_type)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_id      UUID REFERENCES fiscal_periods(id),
  reference      TEXT NOT NULL,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  description    TEXT,
  source         TEXT,            -- 'pos' | 'sale' | 'purchase' | 'expense' | 'manual' | 'treasury'
  source_id      UUID,            -- ID of the originating record
  status         TEXT NOT NULL DEFAULT 'posted',   -- draft | posted | reversed
  reversed_by    UUID REFERENCES journal_entries(id),
  is_posted      BOOLEAN NOT NULL DEFAULT true,
  posted_at      TIMESTAMPTZ,
  posted_by      UUID REFERENCES auth.users(id),
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  description     TEXT,
  debit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit          NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order      INT NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))   -- can't be both debit and credit
);

-- Constraint: journal entries must balance (checked in application, enforced via trigger)
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit  NUMERIC;
  total_credit NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF ABS(total_debit - total_credit) > 0.005 THEN
    RAISE EXCEPTION 'القيد المحاسبي غير متوازن: مدين=% دائن=%', total_debit, total_credit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TREASURY LAYER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  name_ar        TEXT,
  type           TEXT NOT NULL DEFAULT 'cash',   -- cash | bank | credit
  account_number TEXT,
  bank_name      TEXT,
  currency       TEXT NOT NULL DEFAULT 'SAR',
  balance        NUMERIC(15,2) NOT NULL DEFAULT 0,
  coa_account_id UUID REFERENCES chart_of_accounts(id),  -- linked COA account
  is_default     BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES treasury_accounts(id),
  type            TEXT NOT NULL,   -- deposit | withdrawal | transfer_in | transfer_out
  amount          NUMERIC(15,2) NOT NULL,
  balance_after   NUMERIC(15,2) NOT NULL,
  description     TEXT,
  reference       TEXT,
  source          TEXT,            -- 'sale' | 'expense' | 'purchase' | 'manual' | 'transfer'
  source_id       UUID,
  journal_entry_id UUID REFERENCES journal_entries(id),
  transfer_to_id  UUID REFERENCES treasury_accounts(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (amount > 0)
);

-- Trigger: update treasury_accounts.balance after each transaction
CREATE OR REPLACE FUNCTION update_treasury_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE treasury_accounts
    SET balance = balance + CASE
      WHEN NEW.type IN ('deposit', 'transfer_in') THEN NEW.amount
      ELSE -NEW.amount
    END,
    updated_at = NOW()
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_treasury_balance ON treasury_transactions;
CREATE TRIGGER trg_update_treasury_balance
  AFTER INSERT ON treasury_transactions
  FOR EACH ROW EXECUTE FUNCTION update_treasury_balance();

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERP CORE — PRODUCTS & INVENTORY
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES product_categories(id),
  name        TEXT NOT NULL,
  name_ar     TEXT,
  color       TEXT,
  icon        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  name_ar      TEXT,
  abbreviation TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  unit_id             UUID REFERENCES units(id) ON DELETE SET NULL,
  sku                 TEXT,
  barcode             TEXT,
  name                TEXT NOT NULL,
  name_ar             TEXT,
  description         TEXT,
  cost_price          NUMERIC(15,2) NOT NULL DEFAULT 0,
  sell_price          NUMERIC(15,2) NOT NULL DEFAULT 0,
  wholesale_price     NUMERIC(15,2),
  min_qty             INT NOT NULL DEFAULT 1,
  reorder_point       INT NOT NULL DEFAULT 0,
  track_inventory     BOOLEAN NOT NULL DEFAULT true,
  has_expiry          BOOLEAN NOT NULL DEFAULT false,
  has_batch           BOOLEAN NOT NULL DEFAULT false,
  has_variants        BOOLEAN NOT NULL DEFAULT false,
  is_service          BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  tax_rate            NUMERIC(5,2),
  image_url           TEXT,
  attributes          JSONB NOT NULL DEFAULT '{}',  -- {size, color, dosage_form, ...}
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, sku) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS product_variants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku         TEXT,
  barcode     TEXT,
  attributes  JSONB NOT NULL DEFAULT '{}',  -- {size: 'L', color: 'red'}
  cost_price  NUMERIC(15,2),
  sell_price  NUMERIC(15,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  address     TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id    UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity      NUMERIC(15,3) NOT NULL DEFAULT 0,
  reserved_qty  NUMERIC(15,3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, variant_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  variant_id    UUID REFERENCES product_variants(id),
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  type          TEXT NOT NULL,  -- 'sale' | 'purchase' | 'return' | 'adjustment' | 'transfer'
  quantity      NUMERIC(15,3) NOT NULL,  -- positive = in, negative = out
  unit_cost     NUMERIC(15,2),
  reference     TEXT,
  source_id     UUID,
  batch_number  TEXT,
  expiry_date   DATE,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERP CORE — CUSTOMERS & SUPPLIERS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  tax_number    TEXT,
  credit_limit  NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance       NUMERIC(15,2) NOT NULL DEFAULT 0,  -- outstanding balance (positive = owes us)
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  tax_number    TEXT,
  balance       NUMERIC(15,2) NOT NULL DEFAULT 0,  -- amount we owe supplier
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  type            TEXT NOT NULL,  -- 'charge' | 'payment' | 'refund'
  amount          NUMERIC(15,2) NOT NULL,
  balance_after   NUMERIC(15,2) NOT NULL,
  reference       TEXT,
  source_id       UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERP CORE — SALES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sales (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number    TEXT NOT NULL,
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  warehouse_id      UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  treasury_account_id UUID REFERENCES treasury_accounts(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'completed',
  payment_method    TEXT NOT NULL DEFAULT 'cash',
  subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance_due       NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  journal_entry_id  UUID REFERENCES journal_entries(id),
  shift_id          UUID,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  variant_id    UUID REFERENCES product_variants(id),
  quantity      NUMERIC(15,3) NOT NULL,
  unit_price    NUMERIC(15,2) NOT NULL,
  cost_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  total         NUMERIC(15,2) NOT NULL,
  tax_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  batch_number  TEXT,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id             UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  treasury_account_id UUID REFERENCES treasury_accounts(id),
  method              TEXT NOT NULL DEFAULT 'cash',
  amount              NUMERIC(15,2) NOT NULL,
  reference           TEXT,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERP CORE — PURCHASES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number      TEXT NOT NULL,
  supplier_ref        TEXT,
  supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id        UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  treasury_account_id UUID REFERENCES treasury_accounts(id),
  status              TEXT NOT NULL DEFAULT 'received',
  payment_method      TEXT NOT NULL DEFAULT 'cash',
  subtotal            NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total               NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance_due         NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  journal_entry_id    UUID REFERENCES journal_entries(id),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id   UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  variant_id    UUID REFERENCES product_variants(id),
  quantity      NUMERIC(15,3) NOT NULL,
  unit_cost     NUMERIC(15,2) NOT NULL,
  total         NUMERIC(15,2) NOT NULL,
  tax_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  batch_number  TEXT,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id         UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  treasury_account_id UUID REFERENCES treasury_accounts(id),
  method              TEXT NOT NULL DEFAULT 'cash',
  amount              NUMERIC(15,2) NOT NULL,
  reference           TEXT,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERP CORE — EXPENSES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expense_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  coa_account_id UUID REFERENCES chart_of_accounts(id),
  color       TEXT,
  icon        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference           TEXT NOT NULL,
  category_id         UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  treasury_account_id UUID REFERENCES treasury_accounts(id),
  amount              NUMERIC(15,2) NOT NULL,
  description         TEXT NOT NULL,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method      TEXT NOT NULL DEFAULT 'cash',
  receipt_url         TEXT,
  journal_entry_id    UUID REFERENCES journal_entries(id),
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES auth.users(id),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERP CORE — RETURNS & SHIFTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS returns (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference         TEXT NOT NULL,
  sale_id           UUID REFERENCES sales(id),
  customer_id       UUID REFERENCES customers(id),
  total             NUMERIC(15,2) NOT NULL,
  reason            TEXT,
  refund_method     TEXT NOT NULL DEFAULT 'cash',
  journal_entry_id  UUID REFERENCES journal_entries(id),
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id   UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  variant_id  UUID REFERENCES product_variants(id),
  quantity    NUMERIC(15,3) NOT NULL,
  unit_price  NUMERIC(15,2) NOT NULL,
  total       NUMERIC(15,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  opened_by           UUID REFERENCES auth.users(id),
  closed_by           UUID REFERENCES auth.users(id),
  treasury_account_id UUID REFERENCES treasury_accounts(id),
  opening_balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  closing_balance     NUMERIC(15,2),
  total_sales         NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_returns       NUMERIC(15,2) NOT NULL DEFAULT 0,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'open'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- BUSINESS MODULE — DRESS RENTAL
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dresses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  size          TEXT,
  color         TEXT,
  category      TEXT,
  daily_price   NUMERIC(15,2) NOT NULL DEFAULT 0,
  deposit       NUMERIC(15,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'available',  -- available | rented | maintenance
  image_url     TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference         TEXT NOT NULL,
  customer_id       UUID REFERENCES customers(id),
  dress_id          UUID NOT NULL REFERENCES dresses(id),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  days              INT NOT NULL DEFAULT 1,
  daily_price       NUMERIC(15,2) NOT NULL,
  total             NUMERIC(15,2) NOT NULL,
  deposit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | returned | cancelled
  journal_entry_id  UUID REFERENCES journal_entries(id),
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_returns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_order_id UUID NOT NULL REFERENCES rental_orders(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  returned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  condition       TEXT,
  extra_charges   NUMERIC(15,2) NOT NULL DEFAULT 0,
  deposit_refund  NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- BUSINESS MODULE — CONSTRUCTION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS con_projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  client_name     TEXT,
  client_phone    TEXT,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'planning',  -- planning | active | on_hold | completed | cancelled
  priority        TEXT NOT NULL DEFAULT 'medium',    -- low | medium | high | critical
  start_date      DATE,
  end_date        DATE,
  budget          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expenses  NUMERIC(15,2) NOT NULL DEFAULT 0,  -- computed
  total_payments  NUMERIC(15,2) NOT NULL DEFAULT 0,  -- computed
  progress_pct    INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS con_workers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  job_type    TEXT NOT NULL DEFAULT 'other',
  -- CHECK: mason | carpenter | plumber | electrician | painter | tiler | laborer | engineer | supervisor | other
  daily_rate  NUMERIC(15,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'available',
  -- CHECK: available | busy | inactive
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT con_workers_job_type_check CHECK (job_type IN (
    'mason','carpenter','plumber','electrician','painter',
    'tiler','laborer','engineer','supervisor','other'
  )),
  CONSTRAINT con_workers_status_check CHECK (status IN ('available','busy','inactive'))
);

CREATE TABLE IF NOT EXISTS con_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES con_projects(id) ON DELETE CASCADE,
  worker_id    UUID REFERENCES con_workers(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo',
  -- CHECK: todo | in_progress | review | done | blocked
  priority     TEXT NOT NULL DEFAULT 'medium',
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT con_tasks_status_check CHECK (status IN ('todo','in_progress','review','done','blocked'))
);

CREATE TABLE IF NOT EXISTS con_expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES con_projects(id) ON DELETE CASCADE,
  category     TEXT NOT NULL DEFAULT 'other',
  -- CHECK: labor | materials | equipment | transport | subcontract | other
  description  TEXT NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url  TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT con_expenses_category_check CHECK (category IN (
    'labor','materials','equipment','transport','subcontract','other'
  ))
);

CREATE TABLE IF NOT EXISTS con_materials (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES con_projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     NUMERIC(15,3) NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'unit',
  -- CHECK: unit | kg | ton | m | m2 | m3 | liter | box | bag | roll | other
  unit_cost    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost   NUMERIC(15,2) NOT NULL DEFAULT 0,
  supplier     TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT con_materials_unit_check CHECK (unit IN (
    'unit','kg','ton','m','m2','m3','liter','box','bag','roll','other'
  ))
);

CREATE TABLE IF NOT EXISTS con_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES con_projects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'incoming',  -- incoming | outgoing
  amount       NUMERIC(15,2) NOT NULL,
  description  TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  method       TEXT NOT NULL DEFAULT 'cash',
  reference    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS con_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES con_projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  type         TEXT,
  size         INT,
  uploaded_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SAAS & AUDIT LAYER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  severity    TEXT NOT NULL DEFAULT 'info',  -- info | warning | critical
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB NOT NULL DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports_cache (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  params      JSONB NOT NULL DEFAULT '{}',
  data        JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(company_id, report_type, params)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_slug          ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company   ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_memberships_user        ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company     ON memberships(company_id);

-- Products & Inventory
CREATE INDEX IF NOT EXISTS idx_products_company        ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_sku            ON products(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode        ON products(company_id, barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_product       ON inventory(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_company   ON inventory_movements(company_id, created_at DESC);

-- Sales & Purchases
CREATE INDEX IF NOT EXISTS idx_sales_company_date      ON sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer          ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale         ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product      ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_company_date  ON purchases(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

-- Accounting
CREATE INDEX IF NOT EXISTS idx_journal_company_date    ON journal_entries(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_source          ON journal_entries(source, source_id);
CREATE INDEX IF NOT EXISTS idx_jel_entry               ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account             ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_coa_company             ON chart_of_accounts(company_id, code);

-- Treasury
CREATE INDEX IF NOT EXISTS idx_treasury_tx_company     ON treasury_transactions(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_account     ON treasury_transactions(account_id);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_company_date   ON expenses(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category       ON expenses(category_id);

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_company_date      ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action            ON audit_logs(action);

-- Construction
CREATE INDEX IF NOT EXISTS idx_con_projects_company    ON con_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_con_tasks_project       ON con_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_con_expenses_project    ON con_expenses(project_id);
