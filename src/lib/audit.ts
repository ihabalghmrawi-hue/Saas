import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type AuditAction =
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
  // Staff
  | 'staff.created' | 'staff.updated' | 'staff.deleted'
  // Rental
  | 'rental.booked' | 'rental.returned' | 'rental.cancelled'
  // Data lifecycle
  | 'entity.deleted' | 'entity.restored' | 'entity.hard_deleted'
  | 'factory_reset'
  // Backup
  | 'backup.created' | 'backup.restored'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export interface AuditParams {
  action:     AuditAction
  entityType: string
  entityId?:  string
  oldValue?:  any
  newValue?:  any
  metadata?:  any
  severity?:  AuditSeverity
}

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

const SEVERITY_MAP: Partial<Record<AuditAction, AuditSeverity>> = {
  'entity.hard_deleted': 'critical',
  'factory_reset':       'critical',
  'entity.deleted':      'warning',
  'entity.restored':     'info',
  'backup.created':      'info',
  'backup.restored':     'warning',
}

export async function logAudit(params: AuditParams) {
  try {
    const h         = headers()
    const staffId   = h.get('x-staff-id')   || null
    const staffName = h.get('x-staff-name') || null
    const severity  = params.severity ?? SEVERITY_MAP[params.action] ?? 'info'

    const supabase = createClient()
    await supabase.from('audit_logs').insert({
      company_id:  COMPANY_ID,
      staff_id:    staffId !== 'admin' ? staffId : null,
      staff_name:  staffName,
      action:      params.action,
      entity_type: params.entityType,
      entity_id:   params.entityId  || null,
      old_value:   params.oldValue  ? JSON.stringify(params.oldValue)  : null,
      new_value:   params.newValue  ? JSON.stringify(params.newValue)  : null,
      metadata:    params.metadata  ? JSON.stringify(params.metadata)  : null,
      severity,
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}
