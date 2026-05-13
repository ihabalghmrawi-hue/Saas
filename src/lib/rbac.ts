export {
  isSuperAdmin,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  loadRolePermissions,
  parsePermissionsHeader,
  seedDefaultRoles,
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  ROLE_LABELS_AR,
  DEFAULT_ROLE_PERMISSIONS,
  getAllPermissions,
} from './rbac/index'

export type {
  Resource,
  Action,
  Permission,
  ResolvedUser,
  PermissionGroup,
  RolePreset,
} from './rbac/index'

// Backward-compatible dot-notation type alias
export type LegacyPermission =
  | 'sales.view'    | 'sales.create'    | 'sales.refund'
  | 'pos.access'
  | 'purchases.view'| 'purchases.create'
  | 'inventory.view'| 'inventory.edit'
  | 'customers.view'| 'customers.edit'
  | 'expenses.view' | 'expenses.create'
  | 'reports.view'  | 'reports.export'
  | 'rental.view'   | 'rental.create'   | 'rental.manage'
  | 'shifts.manage'
  | 'admin.staff'   | 'admin.settings'  | 'admin.audit'
  | 'users.manage'  | 'subscriptions.manage'

export function createPermissionChecker(permissions: string[]) {
  return (permission: string): boolean => {
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }
}
