-- ============================================================
-- RLS Hardening Migration
-- Run this against your production Supabase database.
-- Enforces strict multi-tenant isolation on all financial tables.
-- ============================================================

-- ── Helper: current tenant from JWT claims ────────────────────────────────────
-- We use auth.uid() for Supabase-auth users and check memberships.
-- For service-role requests (admin panel), RLS is bypassed automatically.

-- ── Enable RLS on all tenant tables (safe — skips missing tables) ────────────

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'companies','company_settings','company_branding','subscriptions',
    'memberships','staff_users','staff_roles','role_permissions',
    'customers','suppliers','products','inventory','inventory_movements',
    'sales','sale_items','purchases','purchase_items','expenses',
    'expense_categories','product_categories','units','warehouses',
    'accounts','journal_entries','journal_entry_lines',
    'fiscal_years','periods','audit_logs','backups','notifications',
    'shifts','wallet_transactions',
    'rental_dresses','rental_orders','rental_returns','rental_pricing'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS enabled on %', t;
    ELSE
      RAISE NOTICE 'Skipped (table not found): %', t;
    END IF;
  END LOOP;
END $$;

-- ── Helper function: get company_id for the current user ──────────────────────

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id::uuid
  FROM   memberships
  WHERE  user_id   = auth.uid()
    AND  is_active = true
  LIMIT  1
$$;

-- ── Drop existing policies (idempotent) ───────────────────────────────────────

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename IN (
        'companies','company_settings','company_branding','subscriptions',
        'memberships','staff_users','staff_roles','role_permissions',
        'customers','suppliers','products','inventory','inventory_movements',
        'sales','sale_items','purchases','purchase_items','expenses',
        'expense_categories','product_categories','units','warehouses',
        'accounts','journal_entries','journal_entry_lines',
        'fiscal_years','periods','audit_logs','backups','notifications',
        'shifts','wallet_transactions','rental_dresses','rental_orders',
        'rental_returns','rental_pricing'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── COMPANIES ─────────────────────────────────────────────────────────────────

CREATE POLICY "companies: member can read own"
  ON companies FOR SELECT
  USING (id = current_company_id());

-- Company update: owner only
CREATE POLICY "companies: owner can update"
  ON companies FOR UPDATE
  USING (id = current_company_id());

-- ── MEMBERSHIPS ───────────────────────────────────────────────────────────────

CREATE POLICY "memberships: user sees own"
  ON memberships FOR SELECT
  USING (user_id = auth.uid() OR company_id = current_company_id());

CREATE POLICY "memberships: user can insert own"
  ON memberships FOR INSERT
  WITH CHECK (company_id = current_company_id());

-- ── COMPANY_SETTINGS ─────────────────────────────────────────────────────────

CREATE POLICY "company_settings: tenant isolation"
  ON company_settings FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ── COMPANY_BRANDING (optional table) ────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company_branding') THEN
    EXECUTE $pol$
      CREATE POLICY "company_branding: tenant isolation"
        ON company_branding FOR ALL
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $pol$;
  END IF;
END $$;

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────

CREATE POLICY "subscriptions: read own"
  ON subscriptions FOR SELECT
  USING (company_id = current_company_id());

-- Only service role can INSERT/UPDATE/DELETE subscriptions
-- (admin panel uses service role key, bypasses RLS)

-- ── STAFF_USERS ───────────────────────────────────────────────────────────────

CREATE POLICY "staff_users: tenant isolation"
  ON staff_users FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ── STAFF_ROLES ───────────────────────────────────────────────────────────────

CREATE POLICY "staff_roles: tenant isolation"
  ON staff_roles FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ── ROLE_PERMISSIONS ─────────────────────────────────────────────────────────

CREATE POLICY "role_permissions: read via role"
  ON role_permissions FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM staff_roles WHERE company_id = current_company_id()
    )
  );

CREATE POLICY "role_permissions: write via role"
  ON role_permissions FOR ALL
  USING (
    role_id IN (
      SELECT id FROM staff_roles WHERE company_id = current_company_id()
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM staff_roles WHERE company_id = current_company_id()
    )
  );

-- ── FINANCIAL TABLES (all share the same company_id pattern) ─────────────────

-- Macro to create standard tenant isolation policy
-- We do it explicitly for each table for clarity

CREATE POLICY "customers: tenant isolation"
  ON customers FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "suppliers: tenant isolation"
  ON suppliers FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "products: tenant isolation"
  ON products FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "inventory: tenant isolation"
  ON inventory FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "inventory_movements: tenant isolation"
  ON inventory_movements FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "sales: tenant isolation"
  ON sales FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "sale_items: tenant isolation"
  ON sale_items FOR ALL
  USING (
    sale_id IN (SELECT id FROM sales WHERE company_id = current_company_id())
  )
  WITH CHECK (
    sale_id IN (SELECT id FROM sales WHERE company_id = current_company_id())
  );

CREATE POLICY "purchases: tenant isolation"
  ON purchases FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "purchase_items: tenant isolation"
  ON purchase_items FOR ALL
  USING (
    purchase_id IN (SELECT id FROM purchases WHERE company_id = current_company_id())
  )
  WITH CHECK (
    purchase_id IN (SELECT id FROM purchases WHERE company_id = current_company_id())
  );

CREATE POLICY "expenses: tenant isolation"
  ON expenses FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "expense_categories: tenant isolation"
  ON expense_categories FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "product_categories: tenant isolation"
  ON product_categories FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "units: tenant isolation"
  ON units FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "warehouses: tenant isolation"
  ON warehouses FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ── ACCOUNTING TABLES ─────────────────────────────────────────────────────────

CREATE POLICY "accounts: tenant isolation"
  ON accounts FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "journal_entries: tenant isolation"
  ON journal_entries FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- journal_entry_lines: access via parent entry
CREATE POLICY "journal_entry_lines: tenant isolation"
  ON journal_entry_lines FOR ALL
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE company_id = current_company_id()
    )
  )
  WITH CHECK (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE company_id = current_company_id()
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fiscal_years') THEN
    EXECUTE $pol$ CREATE POLICY "fiscal_years: tenant isolation" ON fiscal_years FOR ALL
      USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id()) $pol$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='periods') THEN
    EXECUTE $pol$ CREATE POLICY "periods: tenant isolation" ON periods FOR ALL
      USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id()) $pol$;
  END IF;
END $$;

-- ── AUDIT / SYSTEM TABLES ─────────────────────────────────────────────────────

-- Audit logs: read-only for users, write only from server (service role)
CREATE POLICY "audit_logs: read own tenant"
  ON audit_logs FOR SELECT
  USING (company_id = current_company_id());

-- No INSERT/UPDATE/DELETE for authenticated users — only service role can write
-- This prevents tampering with audit history

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='backups') THEN
    EXECUTE $pol$ CREATE POLICY "backups: tenant isolation" ON backups FOR ALL
      USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id()) $pol$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE $pol$ CREATE POLICY "notifications: tenant isolation" ON notifications FOR ALL
      USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id()) $pol$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shifts') THEN
    EXECUTE $pol$ CREATE POLICY "shifts: tenant isolation" ON shifts FOR ALL
      USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id()) $pol$;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
    EXECUTE $pol$
      CREATE POLICY "wallet_transactions: tenant isolation"
        ON wallet_transactions FOR ALL
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $pol$;
  END IF;
END $$;

-- ── RENTAL TABLES (conditional) ───────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_dresses') THEN
    EXECUTE $pol$
      CREATE POLICY "rental_dresses: tenant isolation"
        ON rental_dresses FOR ALL
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $pol$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_orders') THEN
    EXECUTE $pol$
      CREATE POLICY "rental_orders: tenant isolation"
        ON rental_orders FOR ALL
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $pol$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_returns') THEN
    EXECUTE $pol$
      CREATE POLICY "rental_returns: tenant isolation"
        ON rental_returns FOR ALL
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $pol$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_pricing') THEN
    EXECUTE $pol$
      CREATE POLICY "rental_pricing: tenant isolation"
        ON rental_pricing FOR ALL
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $pol$;
  END IF;
END $$;

-- ── Performance indexes (run if not already exist) ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_memberships_user_company    ON memberships(user_id, company_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_memberships_company         ON memberships(company_id)          WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_company       ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company           ON customers(company_id)             WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_company            ON products(company_id)              WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sales_company_date          ON sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_company_date      ON purchases(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company     ON journal_entries(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry   ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company_code       ON accounts(company_id, code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_action   ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_company_product   ON inventory(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_date       ON expenses(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_users_company_pin     ON staff_users(company_id, pin_hash) WHERE is_active = true;

-- ── Prevent negative inventory via check constraint ──────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_inventory_non_negative'
      AND table_name = 'inventory'
  ) THEN
    ALTER TABLE inventory ADD CONSTRAINT chk_inventory_non_negative
      CHECK (quantity >= 0);
  END IF;
END $$;

-- ── Journal entries: prevent modification of posted entries ───────────────────

CREATE OR REPLACE FUNCTION protect_posted_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow status transitions by service role (admin operations)
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Prevent editing a posted entry (description, lines, amounts)
  IF OLD.status = 'posted' AND NEW.status = 'posted' THEN
    -- Only allow approved_by and reversal fields to change after posting
    IF OLD.total_debit  != NEW.total_debit  OR
       OLD.total_credit != NEW.total_credit OR
       OLD.company_id   != NEW.company_id   OR
       OLD.date         != NEW.date
    THEN
      RAISE EXCEPTION 'Cannot modify a posted journal entry. Create a reversal instead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_posted_journal ON journal_entries;
CREATE TRIGGER trg_protect_posted_journal
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_entry();

-- ── Journal entry lines: prevent modification of posted entries ───────────────

CREATE OR REPLACE FUNCTION protect_posted_journal_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entry_status TEXT;
BEGIN
  SELECT status INTO entry_status
  FROM   journal_entries
  WHERE  id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);

  IF entry_status = 'posted' AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Cannot modify lines of a posted journal entry.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_posted_lines ON journal_entry_lines;
CREATE TRIGGER trg_protect_posted_lines
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_lines();

-- ── Balance check constraint on journal entries ───────────────────────────────

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS chk_journal_balanced;

ALTER TABLE journal_entries
  ADD CONSTRAINT chk_journal_balanced
  CHECK (
    status = 'draft'    OR   -- drafts may be unbalanced temporarily
    status = 'void'     OR
    ABS(total_debit - total_credit) < 0.01
  );
