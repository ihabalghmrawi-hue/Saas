import { createClient } from '@/lib/supabase/server'
import { headers }      from 'next/headers'

export type AuditAction =
  // Auth
  | 'auth.login' | 'auth.logout' | 'auth.login_failed'
  // Sales
  | 'sale.created' | 'sale.cancelled' | 'sale.returned'
  | 'payment.added'
  // Customers & Suppliers
  | 'customer.created' | 'customer.updated' | 'customer.deleted'
  | 'supplier.created' | 'supplier.updated' | 'supplier.deleted'
  // Products & Inventory
  | 'product.created' | 'product.updated' | 'product.deleted'
  // Purchases & Expenses
  | 'purchase.created'
  | 'expense.created' | 'expense.deleted'
  // Operations
  | 'shift.opened' | 'shift.closed'
  | 'return.created'
  // Staff & Permissions
  | 'staff.created' | 'staff.updated' | 'staff.deleted'
  | 'permission.changed'
  // Subscription
  | 'subscription.changed' | 'subscription.expired' | 'subscription.renewed'
  // Rental
  | 'rental.booked' | 'rental.returned' | 'rental.cancelled'
  // Data lifecycle
  | 'entity.deleted' | 'entity.restored' | 'entity.hard_deleted'
  | 'factory_reset'
  // Backup
  | 'backup.created' | 'backup.restored'
  // Settings
  | 'settings.updated' | 'branding.updated'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export interface AuditParams {
  action:     AuditAction
  entityType: string
  entityId?:  string
  oldValue?:  unknown
  newValue?:  unknown
  metadata?:  unknown
  severity?:  AuditSeverity
  companyId?: string  // override — falls back to x-tenant-id header
}

const SEVERITY_MAP: Partial<Record<AuditAction, AuditSeverity>> = {
  'auth.login_failed':    'warning',
  'entity.hard_deleted':  'critical',
  'factory_reset':        'critical',
  'subscription.expired': 'warning',
  'permission.changed':   'warning',
  'entity.deleted':       'warning',
  'entity.restored':      'info',
  'backup.created':       'info',
  'backup.restored':      'warning',
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const h         = headers()
    // Use the header set by middleware — this is per-tenant, not global
    const companyId = params.companyId || h.get('x-tenant-id') || process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
    const staffId   = h.get('x-staff-id')   || null
    const staffName = h.get('x-staff-name') || null
    const ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = h.get('user-agent') || null
    const severity  = params.severity ?? SEVERITY_MAP[params.action] ?? 'info'

    // Skip logging for super_admin tenant — no company to log against
    if (companyId === 'super_admin') return

    const supabase = createClient()
    await supabase.from('audit_logs').insert({
      company_id:  companyId,
      staff_id:    staffId !== 'admin' ? staffId : null,
      staff_name:  staffName,
      ip_address:  ipAddress,
      user_agent:  userAgent,
      action:      params.action,
      entity_type: params.entityType,
      entity_id:   params.entityId  || null,
      old_value:   params.oldValue  !== undefined ? JSON.stringify(params.oldValue)  : null,
      new_value:   params.newValue  !== undefined ? JSON.stringify(params.newValue)  : null,
      metadata:    params.metadata  !== undefined ? JSON.stringify(params.metadata)  : null,
      severity,
    })
  } catch (e) {
    // Audit failures should never crash the main request
    console.error('[audit] logAudit error:', e)
  }
}
