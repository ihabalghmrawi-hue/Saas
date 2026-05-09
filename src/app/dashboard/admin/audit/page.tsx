import { createClient } from '@/lib/supabase/server'
import { AuditClient } from './audit-client'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const COMPANY_ID = getCompanyId()
  const h = headers()
  const dec  = (v: string | null, fb = '') => { try { return decodeURIComponent(v || fb) } catch { return v || fb } }
  const role = dec(h.get('x-staff-role'))
  const perms = dec(h.get('x-staff-permissions')).split(',').filter(Boolean)

  const isAdminOrOwner = role === 'admin' || role === 'owner'
  const hasAuditPerm   = perms.includes('*') || perms.includes('admin.audit')
  if (!isAdminOrOwner && !hasAuditPerm) {
    redirect('/dashboard')
  }

  const supabase = createClient()

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(200)

  return <AuditClient logs={logs || []} />
}
