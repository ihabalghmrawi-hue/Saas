export interface OperationalScope {
  type: 'branch' | 'department' | 'entity_type' | 'all'
  values: string[]
}

export interface UserScope {
  userId: string
  userName: string
  role: string
  permissions: string[]
  scope: OperationalScope
  isSuperAdmin: boolean
}

export const SCOPE_RESTRICTIONS = {
  'finance_manager': { type: 'all' as const, values: ['*'] },
  'accountant': { type: 'entity_type' as const, values: ['journal_entry', 'invoice'] },
  'payroll_specialist': { type: 'department' as const, values: ['*'] },
  'inventory_manager': { type: 'branch' as const, values: ['*'] },
  'operator': { type: 'branch' as const, values: ['main'] },
} as Record<string, OperationalScope>

export function getEffectiveScope(userRole: string, userBranch?: string, userDepartment?: string): OperationalScope {
  const restriction = SCOPE_RESTRICTIONS[userRole]
  if (!restriction) return { type: 'all', values: ['*'] }
  
  if (restriction.type === 'branch' && restriction.values[0] === '*') {
    return { type: 'branch', values: userBranch ? [userBranch] : ['*'] }
  }
  if (restriction.type === 'department' && restriction.values[0] === '*') {
    return { type: 'department', values: userDepartment ? [userDepartment] : ['*'] }
  }
  return restriction
}

export function isInScope(entityScope: string, userScope: OperationalScope): boolean {
  if (userScope.values.includes('*')) return true
  return userScope.values.includes(entityScope)
}

export function scopeFilter<T>(items: T[], userScope: UserScope, getScopeValue: (item: T) => string): T[] {
  if (userScope.scope.values.includes('*')) return items
  return items.filter(item => userScope.scope.values.includes(getScopeValue(item)))
}
