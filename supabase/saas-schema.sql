-- ============================================================
-- SAAS MULTI-TENANT SCHEMA
-- Run AFTER base schemas (schema.sql, erp-schema.sql, etc.)
-- ============================================================

-- ── 1. SUBSCRIPTIONS TABLE ───────────────────────────────────────────────────
-- Linked to companies (companies.id = tenant_id in our SaaS model)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              TEXT NOT NULL UNIQUE,   -- our tenant identifier
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'basic', 'pro')),
  status                  TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  trial_ends_at           TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company    ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_cus ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ── 2. STRIPE WEBHOOK LOG ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT NOT NULL UNIQUE,
  event_type   TEXT NOT NULL,
  company_id   TEXT,
  payload      JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  error        TEXT
);

ALTER TABLE stripe_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_webhook_log" ON stripe_webhook_log FOR ALL USING (true) WITH CHECK (true);

-- ── 3. PLAN USAGE TRACKING ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_usage (
  company_id       TEXT PRIMARY KEY,
  products_count   INTEGER NOT NULL DEFAULT 0,
  customers_count  INTEGER NOT NULL DEFAULT 0,
  sales_this_month INTEGER NOT NULL DEFAULT 0,
  bookings_this_month INTEGER NOT NULL DEFAULT 0,
  users_count      INTEGER NOT NULL DEFAULT 1,
  last_updated     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_plan_usage" ON plan_usage FOR ALL USING (true) WITH CHECK (true);

-- ── 4. TENANT ISOLATION FUNCTION ─────────────────────────────────────────────
-- Returns the company_id for the currently authenticated Supabase Auth user.
-- Used in RLS policies for multi-tenant isolation.
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS TEXT AS $$
  SELECT company_id::TEXT
  FROM memberships
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 5. TENANT-AWARE RLS POLICIES ─────────────────────────────────────────────
-- Replace the open `USING (true)` policies with tenant-scoped ones.
-- Run these AFTER enabling RLS on each table (already done in erp-schema.sql).

-- Customers
DROP POLICY IF EXISTS "allow_all_customers"  ON customers;
CREATE POLICY "tenant_customers" ON customers
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Suppliers
DROP POLICY IF EXISTS "allow_all_suppliers"  ON suppliers;
CREATE POLICY "tenant_suppliers" ON suppliers
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Products
DROP POLICY IF EXISTS "allow_all_products"   ON products;
CREATE POLICY "tenant_products" ON products
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Product categories
DROP POLICY IF EXISTS "allow_all_product_categories" ON product_categories;
CREATE POLICY "tenant_product_categories" ON product_categories
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Inventory
DROP POLICY IF EXISTS "allow_all_inventory"  ON inventory;
CREATE POLICY "tenant_inventory" ON inventory
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Sales
DROP POLICY IF EXISTS "allow_all_sales"      ON sales;
CREATE POLICY "tenant_sales" ON sales
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Sale items (via sale's company_id)
DROP POLICY IF EXISTS "allow_all_sale_items" ON sale_items;
CREATE POLICY "tenant_sale_items" ON sale_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.company_id = get_my_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.company_id = get_my_tenant_id())
  );

-- Purchases
DROP POLICY IF EXISTS "allow_all_purchases"  ON purchases;
CREATE POLICY "tenant_purchases" ON purchases
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Expenses
DROP POLICY IF EXISTS "allow_all_expenses"   ON expenses;
CREATE POLICY "tenant_expenses" ON expenses
  FOR ALL USING (company_id = get_my_tenant_id())
  WITH CHECK (company_id = get_my_tenant_id());

-- Dresses
DROP POLICY IF EXISTS "allow_all_dresses"    ON dresses;
CREATE POLICY "tenant_dresses" ON dresses
  FOR ALL USING (company_id::TEXT = get_my_tenant_id())
  WITH CHECK (company_id::TEXT = get_my_tenant_id());

-- Rental orders
DROP POLICY IF EXISTS "allow_all_rental_orders" ON rental_orders;
CREATE POLICY "tenant_rental_orders" ON rental_orders
  FOR ALL USING (company_id::TEXT = get_my_tenant_id())
  WITH CHECK (company_id::TEXT = get_my_tenant_id());

-- Backup snapshots
DROP POLICY IF EXISTS "allow_all_backups"    ON backup_snapshots;
CREATE POLICY "tenant_backups" ON backup_snapshots
  FOR ALL USING (company_id::TEXT = get_my_tenant_id())
  WITH CHECK (company_id::TEXT = get_my_tenant_id());

-- Audit logs
CREATE POLICY "tenant_audit_logs" ON audit_logs
  FOR SELECT USING (company_id = get_my_tenant_id());

-- ── 6. SEED FREE SUBSCRIPTION FOR EXISTING TENANT ────────────────────────────
-- Run this after setup to give the existing single-tenant a free subscription
DO $$
DECLARE
  v_company_id TEXT := current_setting('app.company_id', true);
BEGIN
  IF v_company_id IS NOT NULL AND v_company_id != '' THEN
    INSERT INTO subscriptions (company_id, plan, status)
    VALUES (v_company_id, 'free', 'active')
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
END $$;

-- ── 7. AUTO-PROVISION FREE SUBSCRIPTION ON COMPANY CREATION ──────────────────
CREATE OR REPLACE FUNCTION provision_free_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (company_id, plan, status)
  VALUES (NEW.id::TEXT, 'free', 'trialing')
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION provision_free_subscription();
