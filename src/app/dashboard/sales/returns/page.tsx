import { createClient } from '@/lib/supabase/server'
import { ReturnsClient } from './returns-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ReturnsPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: returns } = await supabase
    .from('sales_returns')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <ReturnsClient
      returns={returns || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
