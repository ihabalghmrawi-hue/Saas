import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('advanced-rbac')

export interface Permission {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'reject' | 'export' | 'import' | 'manage'
  conditions?: PermissionCondition[]
}

export interface PermissionCondition {
  field: string
  operator: 'eq' | 'neq' | 'lt' | 'gt' | 'lte' | 'gte' | 'in' | 'notIn'
  value: unknown
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  inherits: string[]
  isSystem: boolean
  priority: number
}

export interface UserRole {
  userId: string
  tenantId: string
  roleId: string
  scope: 'global' | 'branch' | 'department'
  scopeId?: string
  grantedAt: string
  grantedBy: string
  expiresAt?: string
}

export interface PermissionEvaluation {
  granted: boolean
  reason: string
  source: 'role' | 'inheritance' | 'condition' | 'denied'
  matchedPermission?: Permission
}

const roles = new Map<string, Role>()
const userRoles = new Map<string, UserRole[]>()

export function defineRole(role: Role): void {
  roles.set(role.id, role)
  logger.info(`Role defined: ${role.name} (${role.id})`)
}

export function getRole(roleId: string): Role | undefined {
  return roles.get(roleId)
}

export function getAllRoles(): Role[] {
  return Array.from(roles.values())
}

export function assignRole(userId: string, tenantId: string, roleId: string, options?: {
  scope?: UserRole['scope']; scopeId?: string; grantedBy?: string; expiresAt?: string
}): { success: boolean; error?: string } {
  const role = roles.get(roleId)
  if (!role) return { success: false, error: `Unknown role: ${roleId}` }

  const key = `${userId}:${tenantId}`
  const existing = userRoles.get(key) || []

  existing.push({
    userId,
    tenantId,
    roleId,
    scope: options?.scope || 'global',
    scopeId: options?.scopeId,
    grantedAt: new Date().toISOString(),
    grantedBy: options?.grantedBy || 'system',
    expiresAt: options?.expiresAt,
  })

  userRoles.set(key, existing)
  logger.info(`Role ${roleId} assigned to user ${userId} in tenant ${tenantId}`)
  return { success: true }
}

export function revokeRole(userId: string, tenantId: string, roleId: string): void {
  const key = `${userId}:${tenantId}`
  const existing = userRoles.get(key) || []
  userRoles.set(key, existing.filter(r => r.roleId !== roleId))
  logger.info(`Role ${roleId} revoked from user ${userId} in tenant ${tenantId}`)
}

export function getUserRoles(userId: string, tenantId: string): UserRole[] {
  const key = `${userId}:${tenantId}`
  return (userRoles.get(key) || []).filter(r => {
    if (r.expiresAt && new Date(r.expiresAt) < new Date()) return false
    return true
  })
}

function resolveEffectivePermissions(userId: string, tenantId: string): Permission[] {
  const effective: Permission[] = []
  const seen = new Set<string>()
  const assignedRoles = getUserRoles(userId, tenantId)

  function resolve(roleId: string): void {
    if (seen.has(roleId)) return
    seen.add(roleId)

    const role = roles.get(roleId)
    if (!role) return

    for (const inheritId of role.inherits) {
      resolve(inheritId)
    }

    effective.push(...role.permissions)
  }

  for (const ur of assignedRoles) {
    resolve(ur.roleId)
  }

  return effective
}

export function checkPermission(
  userId: string,
  tenantId: string,
  resource: string,
  action: Permission['action'],
  context?: Record<string, unknown>,
): PermissionEvaluation {
  const permissions = resolveEffectivePermissions(userId, tenantId)

  for (const perm of permissions) {
    if (perm.resource === resource || perm.resource === '*') {
      if (perm.action === action || perm.action === 'manage') {
        if (perm.conditions && perm.conditions.length > 0) {
          const allMet = perm.conditions.every(cond => {
            const contextValue = context?.[cond.field]
            switch (cond.operator) {
              case 'eq': return contextValue === cond.value
              case 'neq': return contextValue !== cond.value
              case 'in': return Array.isArray(cond.value) && (cond.value as unknown[]).includes(contextValue)
              case 'notIn': return !(Array.isArray(cond.value) && (cond.value as unknown[]).includes(contextValue))
              default: return true
            }
          })

          if (allMet) {
            return { granted: true, reason: `Permission ${resource}:${action} via conditional match`, source: 'condition', matchedPermission: perm }
          }
          continue
        }

        return { granted: true, reason: `Permission ${resource}:${action} granted`, source: 'role', matchedPermission: perm }
      }
    }
  }

  return { granted: false, reason: `Permission ${resource}:${action} denied — no matching role`, source: 'denied' }
}

export function hasPermission(userId: string, tenantId: string, resource: string, action: Permission['action'], context?: Record<string, unknown>): boolean {
  return checkPermission(userId, tenantId, resource, action, context).granted
}

export function filterByPermission<T extends Record<string, unknown>>(
  items: T[],
  userId: string,
  tenantId: string,
  resource: string,
  action: Permission['action'],
): T[] {
  if (hasPermission(userId, tenantId, resource, action)) {
    return items
  }
  return items.filter(item => checkPermission(userId, tenantId, resource, action, item).granted)
}

const SYSTEM_ROLES: Role[] = [
  {
    id: 'super_admin', name: 'Super Admin', description: 'Full system access', permissions: [{ resource: '*', action: 'manage' }], inherits: [], isSystem: true, priority: 1000,
  },
  {
    id: 'admin', name: 'Admin', description: 'Tenant-wide administrative access', permissions: [{ resource: '*', action: 'manage' }], inherits: [], isSystem: true, priority: 900,
  },
  {
    id: 'accountant', name: 'Accountant', description: 'Full accounting access', permissions: [
      { resource: 'journal', action: 'create' }, { resource: 'journal', action: 'read' }, { resource: 'journal', action: 'update' },
      { resource: 'journal', action: 'approve' },
      { resource: 'account', action: 'read' }, { resource: 'account', action: 'update' },
      { resource: 'reconciliation', action: 'create' }, { resource: 'reconciliation', action: 'read' },
      { resource: 'report', action: 'read' }, { resource: 'report', action: 'export' },
      { resource: 'period', action: 'read' },
    ], inherits: [], isSystem: true, priority: 500,
  },
  {
    id: 'auditor', name: 'Auditor', description: 'Read-only audit access', permissions: [
      { resource: 'journal', action: 'read' }, { resource: 'account', action: 'read' },
      { resource: 'reconciliation', action: 'read' }, { resource: 'report', action: 'read' },
      { resource: 'report', action: 'export' }, { resource: 'audit', action: 'read' },
    ], inherits: [], isSystem: true, priority: 400,
  },
  {
    id: 'manager', name: 'Manager', description: 'Operational management access', permissions: [
      { resource: 'sales', action: 'read' }, { resource: 'sales', action: 'create' },
      { resource: 'inventory', action: 'read' }, { resource: 'inventory', action: 'update' },
      { resource: 'purchase', action: 'read' }, { resource: 'purchase', action: 'create' },
      { resource: 'customer', action: 'read' }, { resource: 'customer', action: 'update' },
      { resource: 'report', action: 'read' },
    ], inherits: [], isSystem: true, priority: 300,
  },
  {
    id: 'cashier', name: 'Cashier', description: 'POS and basic operations', permissions: [
      { resource: 'sales', action: 'create' }, { resource: 'sales', action: 'read' },
      { resource: 'customer', action: 'read' },
    ], inherits: [], isSystem: true, priority: 200,
  },
  {
    id: 'viewer', name: 'Viewer', description: 'Read-only access', permissions: [
      { resource: 'report', action: 'read' },
    ], inherits: [], isSystem: true, priority: 100,
  },
]

export function registerSystemRoles(): void {
  for (const role of SYSTEM_ROLES) {
    defineRole(role)
  }
  logger.info(`Registered ${SYSTEM_ROLES.length} system roles`)
}
