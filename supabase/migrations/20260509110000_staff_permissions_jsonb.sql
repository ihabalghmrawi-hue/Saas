-- ══════════════════════════════════════════════════════════════════
-- Fix: Store staff permissions as JSONB on staff_roles
-- Run this in Supabase SQL Editor — safe to re-run
-- ══════════════════════════════════════════════════════════════════

-- 1. Ensure staff_roles exists with the permissions column
CREATE TABLE IF NOT EXISTS staff_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL,
  name        TEXT        NOT NULL,
  name_ar     TEXT,
  permissions JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already existed without the column, add it
ALTER TABLE staff_roles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Ensure staff_users exists
CREATE TABLE IF NOT EXISTS staff_users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL,
  role_id     UUID        REFERENCES staff_roles(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  pin_hash    TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_staff_roles_company ON staff_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_company ON staff_users(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_role    ON staff_users(role_id);

-- 4. RLS — permissive (service role used by API)
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_roles_all" ON staff_roles;
CREATE POLICY "staff_roles_all" ON staff_roles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_users_all" ON staff_users;
CREATE POLICY "staff_users_all" ON staff_users FOR ALL USING (true) WITH CHECK (true);

-- 5. Drop the old role_permissions table (no longer needed)
DROP TABLE IF EXISTS role_permissions CASCADE;
