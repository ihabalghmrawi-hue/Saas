import { createClient } from '@/lib/supabase/server'
import { AuditClient } from './audit-client'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function AuditPage() {
  const h = headers()
  const role = h.get('x-staff-role')
  const perms = h.get('x-staff-permissions') || ''

  if (role !== 'admin' && !perms.split(',').includes('admin.audit')) {
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
