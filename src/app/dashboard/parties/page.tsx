import { createClient } from '@/lib/supabase/server'
import { PartiesClient } from './parties-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function PartiesPage() {
  const CURRENCY = getCurrency()
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  const { data: parties } = await supabase
    .from('parties')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('name')

  return <PartiesClient parties={parties || []} companyId={COMPANY_ID} currency={CURRENCY} />
}
