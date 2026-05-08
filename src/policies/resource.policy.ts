/**
 * Resource-level authorization policy.
 *
 * Used in API route handlers after session is verified.
 * Works with the session payload stored in the signed JWT.
 */

export interface MembershipContext {
  role:        string
  permissions: string[]
}

export class PermissionDeniedError extends Error {
  readonly statusCode = 403
  constructor(public readonly permission: string) {
    super(`لا تملك صلاحية: ${permission}`)
    this.name = 'PermissionDeniedError'
  }
}

// ── Checks ───────────────────────────────────────────────────────────────────

export function canPerform(ctx: MembershipContext, permission: string): boolean {
  if (ctx.role === 'owner' || ctx.role === 'admin')  return true
  if (ctx.permissions.includes('*'))                  return true
  return ctx.permissions.includes(permission)
}

export function assertPermission(ctx: MembershipContext, permission: string): void {
  if (!canPerform(ctx, permission)) throw new PermissionDeniedError(permission)
}

// ── Permission constants (mirrors DB permission_code values) ─────────────────

export const Permissions = {
  // Products
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_VIEW:   'product.view',

  // Customers
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',
  CUSTOMER_VIEW:   'customer.view',

  // Sales
  SALE_CREATE:  'sale.create',
  SALE_VOID:    'sale.void',
  SALE_VIEW:    'sale.view',
  RETURN_CREATE: 'return.create',

  // Purchases
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_VIEW:   'purchase.view',

  // Reports
  REPORT_VIEW: 'report.view',

  // Settings
  SETTINGS_UPDATE: 'settings.update',
  BRANDING_UPDATE: 'branding.update',

  // Rentals
  RENTAL_MANAGE: 'rental.manage',

  // Data management
  BACKUP_CREATE:  'backup.create',
  BACKUP_RESTORE: 'backup.restore',
  DATA_RESET:     'data.reset',
} as const

export type Permission = typeof Permissions[keyof typeof Permissions]
