import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { WorkersClient } from './workers-client'

export const dynamic = 'force-dynamic'

export default async function WorkersPage() {
  const admin    = createAdminClient()
  const COMPANY  = getCompanyId()
  const CURRENCY = getCurrency()

  const { data: workers } = await admin
    .from('con_workers')
    .select('*')
    .eq('company_id', COMPANY)
    .order('name')

  return <WorkersClient workers={workers || []} currency={CURRENCY} />
}
