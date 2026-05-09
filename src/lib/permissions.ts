import type { StaffSession } from './session'

// All permission codes
export const PERMISSIONS = {
  POS_ACCESS:       'pos.access',
  POS_DISCOUNT:     'pos.discount',
  POS_CANCEL:       'pos.cancel_sale',
  RETURNS_VIEW:     'returns.view',
  RETURNS_CREATE:   'returns.create',
  CUSTOMERS_VIEW:   'customers.view',
  CUSTOMERS_EDIT:   'customers.edit',
  CUSTOMERS_PAY:    'customers.payment',
  INVENTORY_VIEW:   'inventory.view',
  INVENTORY_EDIT:   'inventory.edit',
  PURCHASES_VIEW:   'purchases.view',
  PURCHASES_CREATE: 'purchases.create',
  EXPENSES_VIEW:    'expenses.view',
  EXPENSES_CREATE:  'expenses.create',
  REPORTS_VIEW:     'reports.view',
  SHIFTS_MANAGE:    'shifts.manage',
  ADMIN_STAFF:      'admin.staff',
  ADMIN_AUDIT:      'admin.audit',
  ADMIN_SETTINGS:   'admin.settings',
} as const

// Route → required permission (null = public/any logged-in user)
export const ROUTE_PERMISSIONS: Record<string, string | null> = {
  '/dashboard/pos':                null,  // all staff can access
  '/dashboard/sales':              'returns.view',
  '/dashboard/returns':            'returns.view',
  '/dashboard/customers':          'customers.view',
  '/dashboard/inventory':          'inventory.view',
  '/dashboard/inventory/movements':'inventory.view',
  '/dashboard/warehouses':         'inventory.view',
  '/dashboard/purchases':          'purchases.view',
  '/dashboard/expenses':           'expenses.view',
  '/dashboard/suppliers':          'purchases.view',
  '/dashboard/reports':            'reports.view',
  '/dashboard/shifts':             'shifts.manage',
  '/dashboard/admin':              'admin.audit',
}

export function can(staff: StaffSession | null, permission: string): boolean {
  if (!staff) return false
  if (staff.role === 'admin') return true
  return staff.permissions.includes(permission)
}

export function canAccessRoute(staff: StaffSession | null, pathname: string): boolean {
  if (!staff) return false
  if (staff.role === 'admin') return true

  for (const [route, perm] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      if (perm === null) return true
      return staff.permissions.includes(perm)
    }
  }
  return true // dashboard root is always accessible
}
