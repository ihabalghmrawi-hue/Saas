-- ════════════════════════════════════════════════
-- RBAC: Roles, Permissions, Staff, Audit Logs
-- ════════════════════════════════════════════════

-- Roles table
CREATE TABLE IF NOT EXISTS staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Permission strings table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label_ar TEXT NOT NULL,
  group_ar TEXT NOT NULL
);

-- Role ↔ Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

-- Staff users (cashiers, managers, etc.)
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES staff_roles(id),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_company ON staff_users(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_pin ON staff_users(company_id, pin_hash);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_staff ON audit_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- RLS
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_staff_roles" ON staff_roles;
CREATE POLICY "allow_all_staff_roles" ON staff_roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_permissions" ON permissions;
CREATE POLICY "allow_all_permissions" ON permissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_role_permissions" ON role_permissions;
CREATE POLICY "allow_all_role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_staff_users" ON staff_users;
CREATE POLICY "allow_all_staff_users" ON staff_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_audit_logs" ON audit_logs;
CREATE POLICY "allow_all_audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════
-- Seed: Default permissions
-- ════════════════════════════════════════════════
INSERT INTO permissions (code, label_ar, group_ar) VALUES
  ('pos.access',           'الوصول لنقطة البيع',      'نقطة البيع'),
  ('pos.discount',         'تطبيق خصم',               'نقطة البيع'),
  ('pos.cancel_sale',      'إلغاء بيع',               'نقطة البيع'),
  ('returns.view',         'عرض المرتجعات',           'المرتجعات'),
  ('returns.create',       'إنشاء مرتجع',             'المرتجعات'),
  ('customers.view',       'عرض العملاء',             'العملاء'),
  ('customers.edit',       'تعديل العملاء',           'العملاء'),
  ('customers.payment',    'تسجيل دفعة عميل',        'العملاء'),
  ('inventory.view',       'عرض المخزون',             'المخزون'),
  ('inventory.edit',       'تعديل المنتجات',          'المخزون'),
  ('purchases.view',       'عرض المشتريات',           'المشتريات'),
  ('purchases.create',     'إنشاء طلب شراء',         'المشتريات'),
  ('expenses.view',        'عرض المصروفات',           'المصروفات'),
  ('expenses.create',      'إضافة مصروف',            'المصروفات'),
  ('reports.view',         'عرض التقارير',            'التقارير'),
  ('shifts.manage',        'إدارة الورديات',          'الورديات'),
  ('admin.staff',          'إدارة الموظفين',          'الإدارة'),
  ('admin.audit',          'سجل الأحداث',             'الإدارة'),
  ('admin.settings',       'الإعدادات',               'الإدارة')
ON CONFLICT (code) DO NOTHING;

-- ════════════════════════════════════════════════
-- Function: seed default roles for a company
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_default_roles(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
  v_manager_id UUID;
  v_cashier_id UUID;
BEGIN
  -- Admin role
  INSERT INTO staff_roles (company_id, name, name_ar, is_system)
  VALUES (p_company_id, 'admin', 'مدير النظام', true)
  ON CONFLICT (company_id, name) DO UPDATE SET name_ar = EXCLUDED.name_ar
  RETURNING id INTO v_admin_id;

  -- Manager role
  INSERT INTO staff_roles (company_id, name, name_ar, is_system)
  VALUES (p_company_id, 'manager', 'مدير', true)
  ON CONFLICT (company_id, name) DO UPDATE SET name_ar = EXCLUDED.name_ar
  RETURNING id INTO v_manager_id;

  -- Cashier role
  INSERT INTO staff_roles (company_id, name, name_ar, is_system)
  VALUES (p_company_id, 'cashier', 'كاشير', true)
  ON CONFLICT (company_id, name) DO UPDATE SET name_ar = EXCLUDED.name_ar
  RETURNING id INTO v_cashier_id;

  -- Admin gets all permissions
  INSERT INTO role_permissions (role_id, permission_code)
  SELECT v_admin_id, code FROM permissions
  ON CONFLICT DO NOTHING;

  -- Manager permissions
  INSERT INTO role_permissions (role_id, permission_code)
  SELECT v_manager_id, code FROM permissions
  WHERE code NOT IN ('admin.staff', 'admin.settings')
  ON CONFLICT DO NOTHING;

  -- Cashier permissions
  INSERT INTO role_permissions (role_id, permission_code)
  VALUES
    (v_cashier_id, 'pos.access'),
    (v_cashier_id, 'pos.discount'),
    (v_cashier_id, 'customers.view'),
    (v_cashier_id, 'returns.view'),
    (v_cashier_id, 'shifts.manage'),
    (v_cashier_id, 'inventory.view')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
