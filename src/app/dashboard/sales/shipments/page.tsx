import { createClient } from '@/lib/supabase/server'
import { ShipmentsClient } from './shipments-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ShipmentsPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: shipments } = await supabase
    .from('sales_shipments')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <ShipmentsClient
      shipments={shipments || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
