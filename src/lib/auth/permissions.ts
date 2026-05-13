export type Permission =
  | 'financial:read' | 'financial:write' | 'financial:post' | 'financial:close'
  | 'inventory:read' | 'inventory:write' | 'inventory:transfer' | 'inventory:adjust'
  | 'procurement:read' | 'procurement:write' | 'procurement:approve' | 'procurement:receive'
  | 'sales:read' | 'sales:write' | 'sales:approve' | 'sales:ship'
  | 'payroll:read' | 'payroll:write' | 'payroll:process' | 'payroll:approve'
  | 'workflow:read' | 'workflow:write' | 'workflow:approve' | 'workflow:escalate'
  | 'admin:users' | 'admin:roles' | 'admin:audit'
  | 'reports:read' | 'reports:export'

export const PERMISSION_GROUPS = {
  المالية: ['financial:read', 'financial:write', 'financial:post', 'financial:close'],
  المخزون: ['inventory:read', 'inventory:write', 'inventory:transfer', 'inventory:adjust'],
  المشتريات: ['procurement:read', 'procurement:write', 'procurement:approve', 'procurement:receive'],
  المبيعات: ['sales:read', 'sales:write', 'sales:approve', 'sales:ship'],
  الرواتب: ['payroll:read', 'payroll:write', 'payroll:process', 'payroll:approve'],
  'سير العمل': ['workflow:read', 'workflow:write', 'workflow:approve', 'workflow:escalate'],
  'الإدارة': ['admin:users', 'admin:roles', 'admin:audit'],
  التقارير: ['reports:read', 'reports:export'],
} as const

export type Role = 'super_admin' | 'finance_manager' | 'accountant' | 'inventory_manager' | 'procurement_manager' | 'sales_manager' | 'hr_manager' | 'payroll_specialist' | 'auditor' | 'operator'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: Object.values(PERMISSION_GROUPS).flat() as Permission[],
  finance_manager: ['financial:read', 'financial:write', 'financial:post', 'financial:close', 'reports:read', 'reports:export'],
  accountant: ['financial:read', 'financial:write'],
  inventory_manager: ['inventory:read', 'inventory:write', 'inventory:transfer', 'inventory:adjust'],
  procurement_manager: ['procurement:read', 'procurement:write', 'procurement:approve'],
  sales_manager: ['sales:read', 'sales:write', 'sales:approve'],
  hr_manager: ['payroll:read', 'payroll:write', 'payroll:approve'],
  payroll_specialist: ['payroll:read', 'payroll:write', 'payroll:process'],
  auditor: ['financial:read', 'inventory:read', 'procurement:read', 'sales:read', 'payroll:read', 'workflow:read', 'reports:read'],
  operator: ['inventory:read', 'inventory:write', 'procurement:read', 'sales:read'],
}

export function hasPermission(userPermissions: string[], permission: Permission): boolean {
  return userPermissions.includes('*') || userPermissions.includes(permission)
}

export function hasAnyPermission(userPermissions: string[], permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(userPermissions, p))
}

export function hasAllPermissions(userPermissions: string[], permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(userPermissions, p))
}

export function filterByPermission<T>(items: T[], userPermissions: string[], getRequiredPermission: (item: T) => Permission): T[] {
  return items.filter(item => hasPermission(userPermissions, getRequiredPermission(item)))
}
