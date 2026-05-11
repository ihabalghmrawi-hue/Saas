/**
 * RBAC — Role Based Access Control
 *
 * Permission format: "resource:action"
 * Examples: "sales:create", "accounting:post", "reports:view"
 *
 * Owners always have all permissions (*).
 * Other roles resolve via role_permissions → permissions join.
 */

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
  permissions: string[]   // ['*'] for owner, list of 'resource:action' for others
  isOwner:     boolean
}

// ── Load permissions for a role ───────────────────────────────────────────────

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

// ── Check if a user (by resolved permissions list) can perform an action ──────

export function hasPermission(
  permissions: string[],
  resource:    Resource,
  action:      Action,
): boolean {
  if (permissions.includes('*')) return true
  if (permissions.includes(`${resource}:${action}`)) return true
  return false
}

// ── Check multiple permissions at once ────────────────────────────────────────

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

// ── Build permission list from request headers (set by middleware) ─────────────

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

// ── Default role permission sets (used when creating a new company) ───────────

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

// ── Seed default roles for a new company ─────────────────────────────────────

export async function seedDefaultRoles(
  supabase:  SupabaseClient,
  companyId: string,
): Promise<void> {
  // Get all permissions from DB
  const { data: allPerms } = await supabase
    .from('permissions')
    .select('id, resource, action')

  const permMap = new Map(
    (allPerms ?? []).map((p: any) => [`${p.resource}:${p.action}`, p.id])
  )

  for (const [roleName, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    // Create role
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

    // Assign permissions
    const rolePerms = perms
      .map(p => permMap.get(p))
      .filter(Boolean)
      .map(permId => ({ role_id: role.id, permission_id: permId }))

    if (rolePerms.length) {
      await supabase.from('role_permissions').insert(rolePerms)
    }
  }
}

const ROLE_LABELS_AR: Record<string, string> = {
  admin:      'مدير',
  manager:    'مشرف',
  accountant: 'محاسب',
  cashier:    'كاشير',
  employee:   'موظف',
}
