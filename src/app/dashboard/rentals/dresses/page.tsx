import { createClient } from '@/lib/supabase/server'
import { DressesClient } from './dresses-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function DressesPage() {
  const CURRENCY = getCurrency()
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const { data: dresses } = await supabase
    .from('dresses').select('*').eq('company_id', COMPANY_ID).neq('status', 'retired').order('created_at', { ascending: false })
  return <DressesClient dresses={dresses || []} currency={CURRENCY} />
}
