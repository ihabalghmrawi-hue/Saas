-- ══════════════════════════════════════════════════════════════════
-- Staff, Roles & Permissions Tables — Idempotent Migration
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── staff_roles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL,
  name       TEXT        NOT NULL,
  name_ar    TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_roles_company ON staff_roles(company_id);

ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_staff_roles" ON staff_roles;
CREATE POLICY "allow_all_staff_roles" ON staff_roles FOR ALL USING (true) WITH CHECK (true);

-- ── role_permissions ──────────────────────────────────────────────
-- Drop and recreate to guarantee correct schema (safe — no FK children)
DROP TABLE IF EXISTS role_permissions CASCADE;

CREATE TABLE role_permissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID        NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
  permission_code TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_role_permissions" ON role_permissions;
CREATE POLICY "allow_all_role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);

-- ── staff_users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL,
  role_id    UUID        REFERENCES staff_roles(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  pin_hash   TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_company ON staff_users(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_role    ON staff_users(role_id);

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_staff_users" ON staff_users;
CREATE POLICY "allow_all_staff_users" ON staff_users FOR ALL USING (true) WITH CHECK (true);
