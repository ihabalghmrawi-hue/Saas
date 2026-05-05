-- ============================================================
-- ADMIN-MANAGED SaaS SCHEMA
-- Run in Supabase SQL Editor
-- Safe to re-run (idempotent)
-- ============================================================

-- ── 1. ROLES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES companies(id) ON DELETE CASCADE,  -- null = global role
  name        TEXT NOT NULL,
  label       TEXT,
  is_system   BOOLEAN DEFAULT false,   -- system roles cannot be deleted
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_roles" ON roles;
CREATE POLICY "allow_all_roles" ON roles FOR ALL USING (true) WITH CHECK (true);

-- Seed global system roles (idempotent)
INSERT INTO roles (id, tenant_id, name, label, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'super_admin', 'سوبر ادمن',   true),
  ('00000000-0000-0000-0000-000000000002', NULL, 'owner',       'مالك',        true),
  ('00000000-0000-0000-0000-000000000003', NULL, 'manager',     'مدير',        true),
  ('00000000-0000-0000-0000-000000000004', NULL, 'cashier',     'كاشير',       true),
  ('00000000-0000-0000-0000-000000000005', NULL, 'viewer',      'عارض فقط',    true)
ON CONFLICT (id) DO NOTHING;

-- ── 2. PERMISSIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  label       TEXT,
  group_name  TEXT   -- e.g. 'sales', 'inventory', 'reports'
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_permissions" ON permissions;
CREATE POLICY "allow_all_permissions" ON permissions FOR ALL USING (true) WITH CHECK (true);

-- Seed all system permissions
INSERT INTO permissions (key, label, group_name) VALUES
  -- Sales
  ('sales.view',        'عرض المبيعات',         'sales'),
  ('sales.create',      'إنشاء فاتورة بيع',     'sales'),
  ('sales.refund',      'إرجاع مبيعات',         'sales'),
  -- POS
  ('pos.access',        'الوصول لنقطة البيع',   'sales'),
  -- Purchases
  ('purchases.view',    'عرض المشتريات',         'purchases'),
  ('purchases.create',  'إنشاء فاتورة شراء',    'purchases'),
  -- Inventory
  ('inventory.view',    'عرض المخزون',           'inventory'),
  ('inventory.edit',    'تعديل المخزون',         'inventory'),
  -- Customers
  ('customers.view',    'عرض العملاء',           'customers'),
  ('customers.edit',    'تعديل العملاء',         'customers'),
  -- Expenses
  ('expenses.view',     'عرض المصروفات',         'expenses'),
  ('expenses.create',   'إضافة مصروف',           'expenses'),
  -- Reports
  ('reports.view',      'عرض التقارير',          'reports'),
  ('reports.export',    'تصدير التقارير',        'reports'),
  -- Rentals
  ('rental.view',       'عرض التأجير',           'rental'),
  ('rental.create',     'إنشاء حجز',             'rental'),
  ('rental.manage',     'إدارة التأجير',         'rental'),
  -- Shifts
  ('shifts.manage',     'إدارة الورديات',        'shifts'),
  -- Admin
  ('admin.staff',       'إدارة الموظفين',        'admin'),
  ('admin.settings',    'إعدادات النظام',        'admin'),
  ('admin.audit',       'سجل الأحداث',           'admin'),
  -- Users & Subscriptions (super admin only)
  ('users.manage',      'إدارة المستخدمين',      'system'),
  ('subscriptions.manage','إدارة الاشتراكات',    'system')
ON CONFLICT (key) DO NOTHING;

-- ── 3. ROLE_PERMISSIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_rp_role ON role_permissions(role_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_rp" ON role_permissions;
CREATE POLICY "allow_all_rp" ON role_permissions FOR ALL USING (true) WITH CHECK (true);

-- Seed role permissions ─────────────────────────────────────────────────────
-- owner: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
ON CONFLICT DO NOTHING;

-- manager: everything except system
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
WHERE group_name != 'system'
ON CONFLICT DO NOTHING;

-- cashier: pos + sales + customers + shifts
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('pos.access','sales.view','sales.create','sales.refund',
              'customers.view','customers.edit','shifts.manage',
              'inventory.view','rental.view','rental.create')
ON CONFLICT DO NOTHING;

-- viewer: view-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions
WHERE key IN ('sales.view','inventory.view','reports.view',
              'customers.view','purchases.view','expenses.view',
              'rental.view')
ON CONFLICT DO NOTHING;

-- ── 4. UPDATE MEMBERSHIPS: add role_id ───────────────────────────────────────
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- Migrate: map existing 'role' text → role_id
UPDATE memberships m
SET role_id = r.id
FROM roles r
WHERE r.name = m.role AND r.tenant_id IS NULL
  AND m.role_id IS NULL;

-- Default unmapped rows to 'owner'
UPDATE memberships
SET role_id = '00000000-0000-0000-0000-000000000002'
WHERE role_id IS NULL;

-- ── 5. UPDATE SUBSCRIPTIONS: add admin-managed fields ────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date   DATE DEFAULT CURRENT_DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date     DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES auth.users(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Ensure status has correct values
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','expired','suspended','trialing'));

-- Backfill: set end_date for active subscriptions without one (90 days trial)
UPDATE subscriptions
SET end_date = CURRENT_DATE + INTERVAL '90 days'
WHERE end_date IS NULL AND status IN ('active','trialing');

-- ── 6. AUTO-EXPIRE: mark subscriptions past end_date ─────────────────────────
-- Run this periodically (or create a pg_cron job)
UPDATE subscriptions
SET status = 'expired'
WHERE end_date IS NOT NULL
  AND end_date < CURRENT_DATE
  AND status = 'active';

-- ── 7. AUTO-PROVISION: give existing companies a subscription if missing ──────
INSERT INTO subscriptions (tenant_id, status, plan, start_date, end_date)
SELECT id, 'active', 'free', CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days'
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.tenant_id = companies.id
)
ON CONFLICT DO NOTHING;

-- ── 8. SUPER ADMIN LOG TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID REFERENCES auth.users(id),
  action       TEXT NOT NULL,
  target_type  TEXT,   -- 'tenant', 'subscription', 'membership', 'role'
  target_id    TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_admin_actions" ON admin_actions;
CREATE POLICY "allow_all_admin_actions" ON admin_actions FOR ALL USING (true) WITH CHECK (true);

SELECT 'Admin schema applied successfully ✓' AS result;
