import { createClient } from '@/lib/supabase/server'
import { SalesClient } from './sales-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const CURRENCY = await getCurrency()
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name, phone), sale_items(id), sale_payments(method, amount)')
    .eq('company_id', COMPANY_ID)
    .order('sale_date', { ascending: false })
    .limit(100)

  return <SalesClient sales={sales || []} currency={CURRENCY} companyId={COMPANY_ID} />
}
