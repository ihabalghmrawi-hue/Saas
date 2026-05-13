import { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Resource =
  | 'sales' | 'purchases' | 'inventory' | 'expenses'
  | 'accounting' | 'treasury' | 'reports'
  | 'customers' | 'suppliers' | 'products'
  | 'users' | 'settings' | 'construction' | 'rentals'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'post' | 'view' | 'export' | 'adjust' | 'transfer' | 'manage' | 'write'

export type Permission = `${Resource}:${Action}`

export interface ResolvedUser {
  userId:      string
  companyId:   string
  role:        string
  permissions: string[]
  isOwner:     boolean
}

// ── Permission groups for UI organisation ─────────────────────────────────────

export interface PermissionGroup {
  key:         string
  label:       string
  labelAr:     string
  permissions: Array<{ resource: Resource; action: Action; label: string; labelAr: string }>
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'sales', label: 'Sales', labelAr: 'المبيعات',
    permissions: [
      { resource: 'sales', action: 'create', label: 'Create Sales', labelAr: 'إنشاء فاتورة بيع' },
      { resource: 'sales', action: 'read',   label: 'View Sales',   labelAr: 'عرض المبيعات' },
      { resource: 'sales', action: 'update', label: 'Edit Sales',   labelAr: 'تعديل المبيعات' },
      { resource: 'sales', action: 'delete', label: 'Delete Sales', labelAr: 'حذف المبيعات' },
    ],
  },
  {
    key: 'purchases', label: 'Purchases', labelAr: 'المشتريات',
    permissions: [
      { resource: 'purchases', action: 'create', label: 'Create Purchases', labelAr: 'إنشاء فاتورة شراء' },
      { resource: 'purchases', action: 'read',   label: 'View Purchases',   labelAr: 'عرض المشتريات' },
      { resource: 'purchases', action: 'update', label: 'Edit Purchases',   labelAr: 'تعديل المشتريات' },
      { resource: 'purchases', action: 'delete', label: 'Delete Purchases', labelAr: 'حذف المشتريات' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', labelAr: 'المخزون',
    permissions: [
      { resource: 'inventory', action: 'read',   label: 'View Inventory',   labelAr: 'عرض المخزون' },
      { resource: 'inventory', action: 'adjust', label: 'Adjust Inventory', labelAr: 'تعديل المخزون' },
      { resource: 'products',  action: 'create', label: 'Create Products',  labelAr: 'إضافة منتج' },
      { resource: 'products',  action: 'read',   label: 'View Products',    labelAr: 'عرض المنتجات' },
      { resource: 'products',  action: 'update', label: 'Edit Products',    labelAr: 'تعديل منتج' },
      { resource: 'products',  action: 'delete', label: 'Delete Products',  labelAr: 'حذف منتج' },
    ],
  },
  {
    key: 'expenses', label: 'Expenses', labelAr: 'المصاريف',
    permissions: [
      { resource: 'expenses', action: 'create', label: 'Add Expense', labelAr: 'إضافة مصروف' },
      { resource: 'expenses', action: 'read',   label: 'View Expenses', labelAr: 'عرض المصروفات' },
      { resource: 'expenses', action: 'delete', label: 'Delete Expense', labelAr: 'حذف مصروف' },
    ],
  },
  {
    key: 'accounting', label: 'Accounting', labelAr: 'المحاسبة',
    permissions: [
      { resource: 'accounting', action: 'read', label: 'View Entries', labelAr: 'عرض القيود المحاسبية' },
      { resource: 'accounting', action: 'post', label: 'Post Entries', labelAr: 'ترحيل قيود محاسبية' },
      { resource: 'treasury',   action: 'read',   label: 'View Treasury',   labelAr: 'عرض الخزينة' },
      { resource: 'treasury',   action: 'transfer', label: 'Transfer',    labelAr: 'تحويل بين حسابات الخزينة' },
    ],
  },
  {
    key: 'reports', label: 'Reports', labelAr: 'التقارير',
    permissions: [
      { resource: 'reports', action: 'view',   label: 'View Reports',   labelAr: 'عرض التقارير' },
      { resource: 'reports', action: 'export', label: 'Export Reports', labelAr: 'تصدير التقارير' },
    ],
  },
  {
    key: 'customers', label: 'Customers', labelAr: 'العملاء',
    permissions: [
      { resource: 'customers', action: 'create', label: 'Add Customer', labelAr: 'إضافة عميل' },
      { resource: 'customers', action: 'read',   label: 'View Customers', labelAr: 'عرض العملاء' },
      { resource: 'customers', action: 'update', label: 'Edit Customer', labelAr: 'تعديل عميل' },
      { resource: 'customers', action: 'delete', label: 'Delete Customer', labelAr: 'حذف عميل' },
    ],
  },
  {
    key: 'suppliers', label: 'Suppliers', labelAr: 'الموردين',
    permissions: [
      { resource: 'suppliers', action: 'create', label: 'Add Supplier', labelAr: 'إضافة مورد' },
      { resource: 'suppliers', action: 'read',   label: 'View Suppliers', labelAr: 'عرض الموردين' },
    ],
  },
  {
    key: 'users', label: 'Users & Settings', labelAr: 'المستخدمين والإعدادات',
    permissions: [
      { resource: 'users',    action: 'manage', label: 'Manage Users',    labelAr: 'إدارة المستخدمين' },
      { resource: 'settings', action: 'manage', label: 'Manage Settings', labelAr: 'إدارة الإعدادات' },
    ],
  },
  {
    key: 'construction', label: 'Construction', labelAr: 'مشاريع البناء',
    permissions: [
      { resource: 'construction', action: 'read',  label: 'View Projects',  labelAr: 'عرض مشاريع البناء' },
      { resource: 'construction', action: 'write', label: 'Manage Projects', labelAr: 'إدارة مشاريع البناء' },
    ],
  },
  {
    key: 'rentals', label: 'Rentals', labelAr: 'الإيجارات',
    permissions: [
      { resource: 'rentals', action: 'read',  label: 'View Rentals',  labelAr: 'عرض الإيجارات' },
      { resource: 'rentals', action: 'write', label: 'Manage Rentals', labelAr: 'إدارة الإيجارات' },
    ],
  },
]

export function getAllPermissions(): Array<{ resource: Resource; action: Action }> {
  return PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => ({ resource: p.resource, action: p.action })))
}

// ── Role presets ───────────────────────────────────────────────────────────────

export interface RolePreset {
  key:         string
  label:       string
  labelAr:     string
  description: string
  descriptionAr: string
  isSystem:    boolean
}

export const ROLE_PRESETS: RolePreset[] = [
  { key: 'admin',      label: 'Admin',       labelAr: 'مدير',       description: 'Full system access',              descriptionAr: 'صلاحية كاملة على النظام',          isSystem: true },
  { key: 'manager',    label: 'Manager',     labelAr: 'مشرف',       description: 'Manage daily operations',        descriptionAr: 'إدارة العمليات اليومية',           isSystem: true },
  { key: 'accountant', label: 'Accountant',  labelAr: 'محاسب',      description: 'Financial and accounting access', descriptionAr: 'صلاحيات مالية ومحاسبية',           isSystem: true },
  { key: 'cashier',    label: 'Cashier',     labelAr: 'كاشير',       description: 'POS and basic sales',              descriptionAr: 'نقطة بيع ومبيعات أساسية',          isSystem: true },
  { key: 'employee',   label: 'Employee',    labelAr: 'موظف',       description: 'View-only read access',            descriptionAr: 'صلاحية عرض فقط',                   isSystem: true },
]

export const ROLE_LABELS_AR: Record<string, string> = {
  admin:      'مدير',
  manager:    'مشرف',
  accountant: 'محاسب',
  cashier:    'كاشير',
  employee:   'موظف',
}

// ── Default role permission sets ───────────────────────────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'sales:create', 'sales:read', 'sales:update', 'sales:delete',
    'purchases:create', 'purchases:read', 'purchases:update', 'purchases:delete',
    'inventory:read', 'inventory:adjust',
    'expenses:create', 'expenses:read', 'expenses:delete',
    'accounting:read', 'accounting:post',
    'treasury:read', 'treasury:transfer',
    'reports:view', 'reports:export',
    'customers:create', 'customers:read', 'customers:update', 'customers:delete',
    'suppliers:create', 'suppliers:read',
    'products:create', 'products:read', 'products:update', 'products:delete',
    'users:manage',
    'construction:read', 'construction:write',
    'rentals:read', 'rentals:write',
  ],
  manager: [
    'sales:create', 'sales:read', 'sales:update',
    'purchases:create', 'purchases:read',
    'inventory:read', 'inventory:adjust',
    'expenses:create', 'expenses:read',
    'reports:view',
    'customers:create', 'customers:read', 'customers:update',
    'suppliers:read',
    'products:read', 'products:update',
    'construction:read', 'construction:write',
    'rentals:read', 'rentals:write',
  ],
  accountant: [
    'sales:read',
    'purchases:read',
    'expenses:read',
    'accounting:read', 'accounting:post',
    'treasury:read',
    'reports:view', 'reports:export',
    'customers:read',
    'suppliers:read',
    'products:read',
  ],
  cashier: [
    'sales:create', 'sales:read',
    'customers:read', 'customers:create',
    'products:read',
    'inventory:read',
  ],
  employee: [
    'sales:read',
    'products:read',
    'customers:read',
    'construction:read',
    'rentals:read',
  ],
}

// ── Super admin check ──────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

// ── Load permissions for a role ────────────────────────────────────────────────

export async function loadRolePermissions(
  supabase: SupabaseClient,
  roleId:   string,
): Promise<string[]> {
  const { data } = await supabase
    .from('role_permissions')
    .select('permissions(resource, action)')
    .eq('role_id', roleId)

  return (data ?? []).map((rp: any) => `${rp.permissions.resource}:${rp.permissions.action}`)
}

// ── Permission checks ──────────────────────────────────────────────────────────

export function hasPermission(
  permissions: string[],
  resource:    Resource,
  action:      Action,
): boolean {
  if (permissions.includes('*')) return true
  return permissions.includes(`${resource}:${action}`)
}

export function hasAnyPermission(
  permissions: string[],
  checks:      Array<[Resource, Action]>,
): boolean {
  return checks.some(([r, a]) => hasPermission(permissions, r, a))
}

export function hasAllPermissions(
  permissions: string[],
  checks:      Array<[Resource, Action]>,
): boolean {
  return checks.every(([r, a]) => hasPermission(permissions, r, a))
}

// ── Parse permissions header ───────────────────────────────────────────────────

export function parsePermissionsHeader(header: string | null): string[] {
  if (!header) return []
  try {
    const decoded = decodeURIComponent(header)
    if (decoded === '*') return ['*']
    return decoded.split(',').map(p => p.trim()).filter(Boolean)
  } catch {
    return []
  }
}

// ── Seed default roles for a new company ──────────────────────────────────────

export async function seedDefaultRoles(
  supabase:  SupabaseClient,
  companyId: string,
): Promise<void> {
  const { data: allPerms } = await supabase
    .from('permissions')
    .select('id, resource, action')

  const permMap = new Map(
    (allPerms ?? []).map((p: any) => [`${p.resource}:${p.action}`, p.id])
  )

  for (const [roleName, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const { data: role } = await supabase
      .from('roles')
      .insert({
        company_id:  companyId,
        name:        roleName,
        name_ar:     ROLE_LABELS_AR[roleName] ?? roleName,
        is_system:   true,
      })
      .select('id')
      .single()

    if (!role) continue

    const rolePerms = perms
      .map(p => permMap.get(p))
      .filter(Boolean)
      .map(permId => ({ role_id: role.id, permission_id: permId }))

    if (rolePerms.length) {
      await supabase.from('role_permissions').insert(rolePerms)
    }
  }
}
