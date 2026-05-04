-- ============================================================
-- DATA LIFECYCLE SYSTEM — Soft Delete + Trash + Audit
-- Run AFTER base schemas (erp-schema.sql, rental-schema.sql, etc.)
-- ============================================================

-- ── 1. ADD SOFT-DELETE COLUMNS TO ALL ENTITY TABLES ─────────────────────────
-- Sales module
ALTER TABLE sales             ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales             ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE customers         ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customers         ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE suppliers         ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE suppliers         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE suppliers         ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Inventory module
ALTER TABLE products          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products          ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE warehouses        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE warehouses        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE warehouses        ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Finance module
ALTER TABLE expenses          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expenses          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expenses          ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE purchases         ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE purchases         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE purchases         ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Rental module
ALTER TABLE dresses           ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dresses           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE dresses           ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE rental_orders     ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rental_orders     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE rental_orders     ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- ── 2. INDEXES FOR SOFT DELETE QUERIES ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_deleted      ON sales(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_customers_deleted  ON customers(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted  ON suppliers(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_deleted   ON products(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted   ON expenses(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_purchases_deleted  ON purchases(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_dresses_deleted    ON dresses(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_rental_orders_deleted ON rental_orders(company_id, is_deleted);

-- ── 3. ENHANCE AUDIT_LOGS TABLE ──────────────────────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity   TEXT NOT NULL DEFAULT 'info'
  CHECK (severity IN ('info', 'warning', 'critical'));

CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_logs(company_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_entity      ON audit_logs(company_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_severity    ON audit_logs(company_id, severity);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs(company_id, created_at DESC);

-- ── 4. ENTITY DEPENDENCY REGISTRY ────────────────────────────────────────────
-- Tracks which entities block deletion of others.
-- Populated by the API layer, but this table holds the rules.
CREATE TABLE IF NOT EXISTS entity_dependency_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type    TEXT NOT NULL,   -- e.g. 'customer'
  child_type     TEXT NOT NULL,   -- e.g. 'sale'
  parent_fk      TEXT NOT NULL,   -- foreign key column on child table, e.g. 'customer_id'
  child_table    TEXT NOT NULL,   -- actual DB table name
  block_on_active BOOLEAN NOT NULL DEFAULT true,  -- block delete if active children exist
  label_ar       TEXT NOT NULL,   -- e.g. 'فواتير مبيعات'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_type, child_type)
);

INSERT INTO entity_dependency_rules (parent_type, child_type, parent_fk, child_table, block_on_active, label_ar) VALUES
  ('customer',  'sale',          'customer_id',  'sales',          true,  'فواتير مبيعات'),
  ('product',   'sale_item',     'product_id',   'sale_items',     false, 'بنود مبيعات'),
  ('product',   'inventory',     'product_id',   'inventory',      false, 'مخزون'),
  ('supplier',  'purchase',      'supplier_id',  'purchases',      true,  'فواتير مشتريات'),
  ('warehouse', 'inventory',     'warehouse_id', 'inventory',      false, 'مخزون'),
  ('dress',     'rental_order',  'dress_id',     'rental_orders',  true,  'حجوزات إيجار'),
  ('expense_category', 'expense', 'category_id', 'expenses',       false, 'مصروفات')
ON CONFLICT (parent_type, child_type) DO NOTHING;

-- ── 5. FACTORY RESET AUDIT ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factory_reset_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   TEXT NOT NULL,
  initiated_by TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  backup_id    UUID REFERENCES backup_snapshots(id),
  tables_cleared JSONB DEFAULT '{}',  -- {"customers": 42, "sales": 100, ...}
  status       TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error        TEXT
);

ALTER TABLE factory_reset_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_reset_log" ON factory_reset_log FOR ALL USING (true) WITH CHECK (true);

-- ── 6. SOFT-DELETE HELPER FUNCTION ───────────────────────────────────────────
-- Usage: SELECT soft_delete_entity('customers', 'uuid-here', 'staff-name');
CREATE OR REPLACE FUNCTION soft_delete_entity(
  p_table     TEXT,
  p_id        UUID,
  p_deleted_by TEXT DEFAULT 'system'
) RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  EXECUTE format(
    'UPDATE %I SET is_deleted = true, deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND is_deleted = false',
    p_table
  ) USING p_deleted_by, p_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ── 7. RESTORE HELPER FUNCTION ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION restore_entity(
  p_table TEXT,
  p_id    UUID
) RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  EXECUTE format(
    'UPDATE %I SET is_deleted = false, deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND is_deleted = true',
    p_table
  ) USING p_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;
