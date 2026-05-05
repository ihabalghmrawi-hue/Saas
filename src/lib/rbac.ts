/**
 * RBAC — Role-Based Access Control
 *
 * Permissions flow:
 *   DB (role_permissions) → middleware (x-staff-permissions header) → here
 *
 * Super admin (email in SUPER_ADMIN_EMAILS) bypasses all permission checks.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Permission =
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

// ── Super admin check ─────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

// ── Permission checker (used in server components + API routes) ───────────────

/**
 * Check if the current request has a permission.
 * Reads from the x-staff-permissions header set by middleware.
 *
 * '*' means all permissions (owner / Supabase auth user).
 */
export function hasPermission(
  permissionsHeader: string | null,
  permission: Permission
): boolean {
  if (!permissionsHeader) return false
  if (permissionsHeader === '*') return true
  return permissionsHeader.split(',').includes(permission)
}

// ── Client-side helper (pass permissions array from context) ──────────────────

export function createPermissionChecker(permissions: string[]) {
  return (permission: Permission): boolean => {
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }
}

// ── Load full permissions for a role from DB (used in middleware) ─────────────

export async function loadRolePermissions(
  supabase: any,
  roleId: string | null | undefined
): Promise<string[]> {
  if (!roleId) return []

  const { data } = await supabase
    .from('role_permissions')
    .select('permissions(key)')
    .eq('role_id', roleId)

  if (!data) return []
  return data.map((r: any) => r.permissions?.key).filter(Boolean)
}
