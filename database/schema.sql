-- =============================================================================
-- MULTI-TENANT ERP SAAS — COMPLETE DATABASE SCHEMA
-- Each table is isolated per company via company_id (TEXT, matches companies.id cast)
-- RLS policies enforce tenant isolation at the database level
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CORE TENANT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  name_ar      TEXT,
  slug         TEXT UNIQUE NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'SAR',
  language     TEXT NOT NULL DEFAULT 'ar',
  timezone     TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  logo_url     TEXT,
  address      TEXT,
  phone        TEXT,
  email        TEXT,
  tax_number   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  settings     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL,               -- references companies.id (TEXT cast, no FK for PostgREST)
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
  status          TEXT NOT NULL DEFAULT 'trialing'
                    CHECK (status IN ('trialing', 'active', 'grace', 'expired', 'suspended', 'cancelled')),
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  trial_ends_at   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth users are managed by Supabase Auth (auth.users)
-- memberships links auth.users → companies
CREATE TABLE IF NOT EXISTS memberships (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
  role_id      UUID,                            -- nullable: links to custom roles table
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, company_id)
);

-- =============================================================================
-- COMPANY SETTINGS & BRANDING
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        TEXT NOT NULL UNIQUE,
  business_type     TEXT NOT NULL DEFAULT 'retail',
  currency          TEXT NOT NULL DEFAULT 'SAR',
  language          TEXT NOT NULL DEFAULT 'ar',
  timezone          TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  tax_rate          NUMERIC(5,2) DEFAULT 15,
  invoice_prefix    TEXT DEFAULT 'INV',
  show_tax          BOOLEAN DEFAULT TRUE,
  pos_theme         TEXT DEFAULT 'default',
  sidebar_items     JSONB,
  dashboard_layout  JSONB,
  notification_pref JSONB,
  fiscal_year_start INTEGER DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_branding (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    TEXT NOT NULL UNIQUE,
  logo_url      TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  accent_color  TEXT DEFAULT '#7c3aed',
  font          TEXT DEFAULT 'system',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STAFF / EMPLOYEES
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  name_ar      TEXT,
  email        TEXT,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'cashier',
  role_id      UUID,
  pin_hash     TEXT,                            -- bcrypt hash of 4–6 digit PIN
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  branch_id    UUID,
  permissions  TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RBAC — ROLES & PERMISSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT,                            -- NULL = system role; non-null = tenant-specific
  name         TEXT NOT NULL,
  label        TEXT NOT NULL,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT NOT NULL UNIQUE,            -- e.g. "create_invoice"
  label        TEXT NOT NULL,
  module       TEXT NOT NULL,                   -- e.g. "sales", "inventory", "settings"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- =============================================================================
-- BRANCHES
-- =============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  is_main      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PRODUCTS / INVENTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  name_ar      TEXT,
  parent_id    UUID REFERENCES categories(id),
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL,
  category_id     UUID REFERENCES categories(id),
  name            TEXT NOT NULL,
  name_ar         TEXT,
  sku             TEXT,
  barcode         TEXT,
  unit            TEXT DEFAULT 'piece',
  cost_price      NUMERIC(12,3) DEFAULT 0,
  sell_price      NUMERIC(12,3) NOT NULL DEFAULT 0,
  wholesale_price NUMERIC(12,3),
  min_qty         NUMERIC(12,3) DEFAULT 0,
  track_inventory BOOLEAN DEFAULT TRUE,
  has_expiry      BOOLEAN DEFAULT FALSE,
  has_variants    BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  image_url       TEXT,
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,                   -- e.g. "L / Red"
  sku          TEXT,
  barcode      TEXT,
  sell_price   NUMERIC(12,3),
  stock        NUMERIC(12,3) DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id),
  quantity     NUMERIC(12,3) NOT NULL DEFAULT 0,
  batch_no     TEXT,
  expiry_date  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  product_id   UUID NOT NULL REFERENCES products(id),
  branch_id    UUID REFERENCES branches(id),
  type         TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity     NUMERIC(12,3) NOT NULL,
  notes        TEXT,
  reference_id UUID,
  staff_id     UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CUSTOMERS & SUPPLIERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  balance      NUMERIC(12,3) DEFAULT 0,
  tax_number   TEXT,
  notes        TEXT,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  balance      NUMERIC(12,3) DEFAULT 0,
  notes        TEXT,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SALES
-- =============================================================================

CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL,
  invoice_number  TEXT NOT NULL,
  customer_id     UUID REFERENCES customers(id),
  staff_id        UUID REFERENCES staff(id),
  branch_id       UUID REFERENCES branches(id),
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal        NUMERIC(12,3) NOT NULL DEFAULT 0,
  discount        NUMERIC(12,3) DEFAULT 0,
  tax             NUMERIC(12,3) DEFAULT 0,
  total           NUMERIC(12,3) NOT NULL DEFAULT 0,
  paid            NUMERIC(12,3) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('draft', 'completed', 'returned', 'cancelled')),
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  company_id   TEXT NOT NULL,
  product_id   UUID REFERENCES products(id),
  variant_id   UUID REFERENCES product_variants(id),
  name         TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL,
  unit_price   NUMERIC(12,3) NOT NULL,
  discount     NUMERIC(12,3) DEFAULT 0,
  total        NUMERIC(12,3) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  company_id   TEXT NOT NULL,
  method       TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer', 'credit')),
  amount       NUMERIC(12,3) NOT NULL,
  reference    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  sale_id      UUID NOT NULL REFERENCES sales(id),
  reason       TEXT,
  total        NUMERIC(12,3) NOT NULL,
  staff_id     UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PURCHASES
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL,
  ref_number      TEXT,
  supplier_id     UUID REFERENCES suppliers(id),
  branch_id       UUID REFERENCES branches(id),
  purchase_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal        NUMERIC(12,3) NOT NULL DEFAULT 0,
  tax             NUMERIC(12,3) DEFAULT 0,
  total           NUMERIC(12,3) NOT NULL DEFAULT 0,
  paid            NUMERIC(12,3) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('draft', 'received', 'cancelled')),
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id  UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  company_id   TEXT NOT NULL,
  product_id   UUID REFERENCES products(id),
  name         TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL,
  unit_cost    NUMERIC(12,3) NOT NULL,
  total        NUMERIC(12,3) NOT NULL,
  expiry_date  DATE,
  batch_no     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EXPENSES
-- =============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(12,3) NOT NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT,
  staff_id     UUID REFERENCES staff(id),
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CASH / SHIFTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS shifts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     TEXT NOT NULL,
  staff_id       UUID REFERENCES staff(id),
  branch_id      UUID REFERENCES branches(id),
  opening_cash   NUMERIC(12,3) NOT NULL DEFAULT 0,
  closing_cash   NUMERIC(12,3),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RENTALS (dress rental module)
-- =============================================================================

CREATE TABLE IF NOT EXISTS rental_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  code            TEXT,
  category        TEXT,
  daily_rate      NUMERIC(12,3) NOT NULL DEFAULT 0,
  deposit         NUMERIC(12,3) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'rented', 'maintenance', 'retired')),
  image_url       TEXT,
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      TEXT NOT NULL,
  item_id         UUID REFERENCES rental_items(id),
  customer_id     UUID REFERENCES customers(id),
  staff_id        UUID REFERENCES staff(id),
  booking_date    DATE NOT NULL,
  return_date     DATE NOT NULL,
  deposit_paid    NUMERIC(12,3) DEFAULT 0,
  rental_price    NUMERIC(12,3) NOT NULL,
  discount        NUMERIC(12,3) DEFAULT 0,
  total           NUMERIC(12,3) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked', 'active', 'returned', 'cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ACCOUNTING / JOURNAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  entry_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  reference    TEXT,
  description  TEXT,
  debit        NUMERIC(12,3) NOT NULL DEFAULT 0,
  credit       NUMERIC(12,3) NOT NULL DEFAULT 0,
  account      TEXT NOT NULL,
  staff_id     UUID REFERENCES staff(id),
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  staff_id     UUID,
  staff_name   TEXT,
  ip_address   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL DEFAULT 'unknown',
  entity_id    TEXT,
  severity     TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DEVICE / SESSION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS devices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   TEXT NOT NULL,
  staff_id     UUID REFERENCES staff(id),
  device_name  TEXT,
  user_agent   TEXT,
  ip_address   TEXT,
  last_seen    TIMESTAMPTZ DEFAULT NOW(),
  is_trusted   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id   ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id        ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company_id     ON memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_company_id           ON staff(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id        ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company_id           ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date            ON sales(company_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_purchases_company_id       ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id       ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id       ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id        ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_company_product  ON inventory(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id      ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at      ON audit_logs(company_id, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Every table is isolated per company_id
-- The helper function reads x-tenant-id from the request context
-- =============================================================================

-- Helper: resolves current tenant from Supabase JWT claim set by your middleware
-- In Supabase, set custom JWT claims via auth.uid() → memberships → company_id
-- OR: use service role for admin APIs (bypasses RLS), anon role for client APIs

-- Enable RLS on every tenant table
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_branding    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_returns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices             ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICY PATTERN
-- Authenticated users (via Supabase Auth) can only see their own company's data.
-- Service role key (used by admin API) bypasses RLS automatically.
-- =============================================================================

-- companies: owner can read their own row
CREATE POLICY "company_self_read" ON companies
  FOR SELECT USING (
    id::TEXT IN (
      SELECT company_id FROM memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Generic macro for all tenant tables that have company_id TEXT column
-- Each table gets: owner can read/write their own company's data only

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'subscriptions','company_settings','company_branding','staff','branches',
    'categories','products','product_variants','inventory','inventory_movements',
    'customers','suppliers','sales','sale_items','sale_payments','sale_returns',
    'purchases','purchase_items','expenses','shifts','rental_items','rental_bookings',
    'journal_entries','audit_logs','devices'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY "tenant_isolation_%1$s" ON %1$s
       USING (
         company_id IN (
           SELECT company_id FROM memberships
           WHERE user_id = auth.uid() AND is_active = TRUE
         )
       )
       WITH CHECK (
         company_id IN (
           SELECT company_id FROM memberships
           WHERE user_id = auth.uid() AND is_active = TRUE
         )
       )',
      t
    );
  END LOOP;
END;
$$;

-- memberships: users can see their own memberships
CREATE POLICY "memberships_self" ON memberships
  FOR ALL USING (user_id = auth.uid());

-- =============================================================================
-- DEFAULT PERMISSIONS SEED
-- =============================================================================

INSERT INTO permissions (key, label, module) VALUES
  ('create_invoice',     'إنشاء فاتورة',          'sales'),
  ('edit_invoice',       'تعديل فاتورة',           'sales'),
  ('delete_invoice',     'حذف فاتورة',             'sales'),
  ('view_sales',         'عرض المبيعات',           'sales'),
  ('manage_inventory',   'إدارة المخزون',          'inventory'),
  ('manage_products',    'إدارة المنتجات',         'inventory'),
  ('manage_customers',   'إدارة العملاء',          'customers'),
  ('manage_suppliers',   'إدارة الموردين',         'suppliers'),
  ('manage_purchases',   'إدارة المشتريات',        'purchases'),
  ('view_reports',       'عرض التقارير',           'reports'),
  ('manage_expenses',    'إدارة المصاريف',         'expenses'),
  ('manage_users',       'إدارة المستخدمين',       'settings'),
  ('manage_settings',    'إدارة الإعدادات',        'settings'),
  ('manage_roles',       'إدارة الصلاحيات',        'settings'),
  ('access_pos',         'الوصول لنقطة البيع',     'pos'),
  ('manage_shifts',      'إدارة الورديات',         'shifts'),
  ('factory_reset',      'إعادة تعيين المصنع',     'danger'),
  ('manage_rentals',     'إدارة الإيجارات',        'rentals'),
  ('view_audit_log',     'عرض سجل الأحداث',        'admin')
ON CONFLICT (key) DO NOTHING;
