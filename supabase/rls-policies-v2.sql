-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES — Production v2
-- Run AFTER schema-v2.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Helper function: resolve company_id from JWT claims ───────────────────────
-- This is called from RLS policies. It reads the company_id that was embedded
-- in the JWT by a Supabase DB function/trigger when the user logs in.
-- For server-side (service role), RLS is bypassed entirely.

CREATE OR REPLACE FUNCTION get_company_id()
RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('app.current_company_id', true),
    ''
  )::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Alternative: resolve via memberships (more reliable for SSR) ──────────────
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM memberships
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Enable RLS on all tenant tables ───────────────────────────────────────────
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_mappings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE units               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE dresses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_workers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- ── Macro: create standard 4-policy set for a company-scoped table ─────────────
-- Usage: SELECT create_tenant_policies('sales');

CREATE OR REPLACE FUNCTION create_tenant_policies(tbl TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "%s_select" ON %I;
    CREATE POLICY "%s_select" ON %I
      FOR SELECT USING (company_id = get_user_company_id());

    DROP POLICY IF EXISTS "%s_insert" ON %I;
    CREATE POLICY "%s_insert" ON %I
      FOR INSERT WITH CHECK (company_id = get_user_company_id());

    DROP POLICY IF EXISTS "%s_update" ON %I;
    CREATE POLICY "%s_update" ON %I
      FOR UPDATE USING (company_id = get_user_company_id());

    DROP POLICY IF EXISTS "%s_delete" ON %I;
    CREATE POLICY "%s_delete" ON %I
      FOR DELETE USING (company_id = get_user_company_id());
  ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
END;
$$ LANGUAGE plpgsql;

-- ── Apply standard policies to all company-scoped tables ─────────────────────
SELECT create_tenant_policies('company_settings');
SELECT create_tenant_policies('fiscal_periods');
SELECT create_tenant_policies('chart_of_accounts');
SELECT create_tenant_policies('account_mappings');
SELECT create_tenant_policies('journal_entries');
SELECT create_tenant_policies('treasury_accounts');
SELECT create_tenant_policies('treasury_transactions');
SELECT create_tenant_policies('product_categories');
SELECT create_tenant_policies('units');
SELECT create_tenant_policies('products');
SELECT create_tenant_policies('warehouses');
SELECT create_tenant_policies('inventory');
SELECT create_tenant_policies('inventory_movements');
SELECT create_tenant_policies('customers');
SELECT create_tenant_policies('suppliers');
SELECT create_tenant_policies('customer_transactions');
SELECT create_tenant_policies('sales');
SELECT create_tenant_policies('sale_payments');
SELECT create_tenant_policies('purchases');
SELECT create_tenant_policies('purchase_payments');
SELECT create_tenant_policies('expense_categories');
SELECT create_tenant_policies('expenses');
SELECT create_tenant_policies('returns');
SELECT create_tenant_policies('shifts');
SELECT create_tenant_policies('dresses');
SELECT create_tenant_policies('rental_orders');
SELECT create_tenant_policies('con_projects');
SELECT create_tenant_policies('con_workers');
SELECT create_tenant_policies('con_tasks');
SELECT create_tenant_policies('con_expenses');
SELECT create_tenant_policies('con_materials');
SELECT create_tenant_policies('con_payments');
SELECT create_tenant_policies('con_files');
SELECT create_tenant_policies('audit_logs');
SELECT create_tenant_policies('notifications');
SELECT create_tenant_policies('roles');

-- ── Child tables (FK to parent, not company_id directly) ─────────────────────

-- journal_entry_lines → via journal_entries
DROP POLICY IF EXISTS "jel_select" ON journal_entry_lines;
CREATE POLICY "jel_select" ON journal_entry_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_id
      AND je.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "jel_insert" ON journal_entry_lines;
CREATE POLICY "jel_insert" ON journal_entry_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_id
      AND je.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "jel_delete" ON journal_entry_lines;
CREATE POLICY "jel_delete" ON journal_entry_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_id
      AND je.company_id = get_user_company_id()
  ));

-- sale_items → via sales
DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY "sale_items_select" ON sale_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sales s WHERE s.id = sale_id AND s.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales s WHERE s.id = sale_id AND s.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;
CREATE POLICY "sale_items_delete" ON sale_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM sales s WHERE s.id = sale_id AND s.company_id = get_user_company_id()
  ));

-- purchase_items → via purchases
DROP POLICY IF EXISTS "purchase_items_select" ON purchase_items;
CREATE POLICY "purchase_items_select" ON purchase_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchases p WHERE p.id = purchase_id AND p.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "purchase_items_insert" ON purchase_items;
CREATE POLICY "purchase_items_insert" ON purchase_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchases p WHERE p.id = purchase_id AND p.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "purchase_items_delete" ON purchase_items;
CREATE POLICY "purchase_items_delete" ON purchase_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM purchases p WHERE p.id = purchase_id AND p.company_id = get_user_company_id()
  ));

-- return_items → via returns
DROP POLICY IF EXISTS "return_items_select" ON return_items;
CREATE POLICY "return_items_select" ON return_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM returns r WHERE r.id = return_id AND r.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "return_items_insert" ON return_items;
CREATE POLICY "return_items_insert" ON return_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM returns r WHERE r.id = return_id AND r.company_id = get_user_company_id()
  ));

-- product_variants → via products
DROP POLICY IF EXISTS "product_variants_select" ON product_variants;
CREATE POLICY "product_variants_select" ON product_variants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND p.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "product_variants_insert" ON product_variants;
CREATE POLICY "product_variants_insert" ON product_variants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND p.company_id = get_user_company_id()
  ));
DROP POLICY IF EXISTS "product_variants_delete" ON product_variants;
CREATE POLICY "product_variants_delete" ON product_variants FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND p.company_id = get_user_company_id()
  ));

-- rental_returns → via rental_orders
DROP POLICY IF EXISTS "rental_returns_select" ON rental_returns;
CREATE POLICY "rental_returns_select" ON rental_returns FOR SELECT
  USING (company_id = get_user_company_id());
DROP POLICY IF EXISTS "rental_returns_insert" ON rental_returns;
CREATE POLICY "rental_returns_insert" ON rental_returns FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

-- role_permissions → via roles
DROP POLICY IF EXISTS "role_perms_select" ON role_permissions;
CREATE POLICY "role_perms_select" ON role_permissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM roles r WHERE r.id = role_id AND r.company_id = get_user_company_id()
  ));

-- memberships: users can only see memberships in their own company
DROP POLICY IF EXISTS "memberships_select" ON memberships;
CREATE POLICY "memberships_select" ON memberships FOR SELECT
  USING (company_id = get_user_company_id() OR user_id = auth.uid());

-- companies: users can read their own company
DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies FOR SELECT
  USING (id = get_user_company_id());

-- subscriptions: users can read their company's subscription
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT
  USING (company_id = get_user_company_id());

-- plans: public read
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select" ON plans;
CREATE POLICY "plans_select" ON plans FOR SELECT USING (is_active = true);

-- permissions: public read (needed for RBAC resolution)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_select" ON permissions;
CREATE POLICY "permissions_select" ON permissions FOR SELECT USING (true);
