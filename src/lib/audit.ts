import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type AuditAction =
  | 'sale.created' | 'sale.cancelled' | 'sale.returned'
  | 'payment.added' | 'customer.created' | 'customer.updated' | 'customer.deleted'
  | 'product.created' | 'product.updated' | 'product.deleted'
  | 'purchase.created'
  | 'expense.created' | 'expense.deleted'
  | 'shift.opened' | 'shift.closed'
  | 'staff.created' | 'staff.updated' | 'staff.deleted'
  | 'return.created'

export interface AuditParams {
  action: AuditAction
  entityType: string
  entityId?: string
  oldValue?: any
  newValue?: any
  metadata?: any
}

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export async function logAudit(params: AuditParams) {
  try {
    const h = headers()
    const staffId = h.get('x-staff-id') || null
    const staffName = h.get('x-staff-name') || null

    const supabase = createClient()
    await supabase.from('audit_logs').insert({
      company_id: COMPANY_ID,
      staff_id: staffId !== 'admin' ? staffId : null,
      staff_name: staffName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      new_value: params.newValue ? JSON.stringify(params.newValue) : null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    })
  } catch (e) {
    // Audit log failures should never break the main flow
    console.error('Audit log error:', e)
  }
}
